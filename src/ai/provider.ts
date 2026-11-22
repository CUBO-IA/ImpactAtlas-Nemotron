import { generateText, streamText } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import type { ChatRequest } from "../contracts/chat.ts";
import type { ChatEvidence } from "../server/chat.ts";
import {
  breakdownSchema,
  departmentIdSchema,
  departmentMetricSchema,
  groupBySchema,
  metricIdSchema,
  unique,
} from "../contracts/common.ts";
import { chatPlanSchema, cohortFields } from "./tools.ts";
import { lfm3 } from "./lfm3.ts";
import { EDUCATION, GOALS, OCCUPATIONS } from "../lib/catalog-data.ts";

type CohortInput = { occupationId?: string; educationId?: string; goalId?: string; minIncome?: number; maxIncome?: number };

/** Sin deadline propio: solo cancelación del cliente o un timeout explícito en pruebas. */
function chatSignal(signal: AbortSignal | undefined, timeoutMs?: number): AbortSignal {
  if (!timeoutMs) return signal ?? new AbortController().signal;
  const deadline = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, deadline]) : deadline;
}

export type ToolCall =
  | {
      name: "get_statistics";
      input: { groupBy: "department" | "education" | "occupation" | "goal"; metrics: string[] } & CohortInput;
    }
  | { name: "compare_departments"; input: { departmentIds: string[]; referenceDepartmentId: string; metrics: string[]; breakdowns: string[] } & CohortInput }
  | { name: "search_semantic_evidence"; input: { text: string; topK: number } };

export type ChatPlan =
  | { status: "needs_clarification"; question: string; calls: [] }
  | { status: "execute"; calls: ToolCall[] };

export interface ChatProvider {
  plan(input: Pick<ChatRequest, "question" | "history" | "filters">, signal?: AbortSignal): Promise<unknown>;
  answer(input: { request: ChatRequest; evidence: ChatEvidence[] }, signal?: AbortSignal, onText?: (text: string) => void): Promise<string>;
  describeCapabilities?(signal?: AbortSignal): Promise<string>;
  /** Selecciona hechos verificables por id; nunca redacta cifras propias. */
  selectFacts?(input: {
    question: string;
    facts: { id: string; label: string; value: number | null; unit: string }[];
  }, signal?: AbortSignal): Promise<string[]>;
}

export class LocalModelUnavailableError extends Error {
  constructor() {
    super("El modelo local no está disponible o no pudo inicializarse.");
    this.name = "LocalModelUnavailableError";
  }
}

export class InvalidLocalChatPlanError extends Error {
  readonly detail: string;

  constructor(detail = "No se encontró una llamada válida.") {
    super("El modelo local generó una llamada a herramienta no válida.");
    this.name = "InvalidLocalChatPlanError";
    this.detail = detail;
  }
}

let provider: ChatProvider | undefined;
let providerWasConfigured = false;

export function configureChatProvider(value: ChatProvider | undefined) {
  provider = value;
  providerWasConfigured = true;
}

export function getChatProvider() {
  return providerWasConfigured ? provider : (provider = createLocalChatProvider());
}

const tools = {
  get_statistics: {
    description: "Consulta métricas y distribuciones agregadas de la muestra, por territorio o perfil.",
    inputSchema: z.strictObject({
      groupBy: groupBySchema,
      metrics: unique(metricIdSchema, 1, 6),
      ...cohortFields,
    }),
  },
  compare_departments: {
    description: "Compara departamentos del conjunto usando métricas deterministas permitidas.",
    inputSchema: z.strictObject({
      departmentIds: unique(departmentIdSchema, 2, 14),
      referenceDepartmentId: departmentIdSchema,
      metrics: unique(departmentMetricSchema, 0, 4),
      breakdowns: unique(breakdownSchema, 0, 3),
      ...cohortFields,
    }).refine(({ departmentIds, referenceDepartmentId }) => departmentIds.includes(referenceDepartmentId))
      .refine(({ metrics, breakdowns }) => metrics.length + breakdowns.length > 0),
  },
} as const;

// Qwen usa XML en tool calling nativo; el adaptador local solo interpreta JSON.
const planningTools = JSON.stringify(Object.entries(tools).map(([name, definition]) => ({
  name,
  description: definition.description,
  inputSchema: z.toJSONSchema(definition.inputSchema),
})));

function parseLocalToolCalls(text: string): unknown[] {
  const calls: unknown[] = [];
  const callPattern = /<tool_call>\s*<function=([A-Za-z_][A-Za-z0-9_]*)>([\s\S]*?)<\/function>\s*<\/tool_call>/g;
  for (const match of text.matchAll(callPattern)) {
    const input: Record<string, unknown> = {};
    const parameters = match[2]!.matchAll(/<parameter=([^>\n]+)>\s*([\s\S]*?)\s*<\/parameter>/g);
    for (const parameter of parameters) {
      const key = parameter[1]!.trim();
      const value = parameter[2]!.trim();
      try {
        input[key] = JSON.parse(value);
      } catch {
        input[key] = value;
      }
    }
    calls.push({ name: match[1], input });
  }
  return calls;
}

function parseLocalPlan(text: string, sdkCalls: unknown[]) {
  text = text.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1").trim();
  const isJson = text.startsWith("{") || text.startsWith("[");
  let calls = sdkCalls.length ? sdkCalls : parseLocalToolCalls(text);
  if (!calls.length && !isJson && /\b(?:get_statistics|compare_departments|search_semantic_evidence)\b/i.test(text)) {
    throw new InvalidLocalChatPlanError();
  }
  if (!calls.length && text && !isJson && !text.includes("<tool_call>")) {
    return { status: "answered" as const, text, calls: [] };
  }
  if (!calls.length && isJson) {
    try {
      const candidate = JSON.parse(text);
      if (Array.isArray(candidate)) calls = candidate;
      else if (candidate && Array.isArray(candidate.calls)) calls = candidate.calls;
    } catch {
      throw new InvalidLocalChatPlanError();
    }
  }
  const normalizedCalls = calls.map((call) => {
    if (!call || typeof call !== "object" || !("name" in call) || call.name !== "compare_departments"
      || !("input" in call) || !call.input || typeof call.input !== "object"
      || !("breakdowns" in call.input) || !Array.isArray(call.input.breakdowns)) return call;
    const breakdowns = call.input.breakdowns.filter((value) => breakdownSchema.safeParse(value).success);
    if (breakdowns.length !== call.input.breakdowns.length) {
      console.warn("Ignored unsupported breakdowns in local chat plan", {
        count: call.input.breakdowns.length - breakdowns.length,
      });
    }
    return { ...call, input: { ...call.input, breakdowns } };
  });
  const parsed = chatPlanSchema.safeParse({ status: "execute", calls: normalizedCalls });
  if (!parsed.success) {
    throw new InvalidLocalChatPlanError(parsed.error.issues.map((issue) =>
      `${issue.path.join(".") || "plan"}: ${issue.message}`,
    ).join("; "));
  }
  if (parsed.data.calls.some(({ name }) => !Object.hasOwn(tools, name))) {
    throw new InvalidLocalChatPlanError("Usa solo get_statistics o compare_departments.");
  }
  return parsed.data;
}

const applicationContext = `Eres el asistente de una aplicación para explorar una muestra socioeconómica de El Salvador.
La aplicación ofrece un explorador con mapa y filtros por departamento, ingreso, educación, ocupación y metas; un comparador de departamentos; y este chat para consultar estadísticas agregadas, como ingresos estimados, conteos y exclusión financiera.
Los resultados describen únicamente la muestra: no prueban causalidad ni representan necesariamente a toda la población. No inventes cifras ni capacidades. La búsqueda semántica no está disponible.
La ocupación Técnico es general: no identifica electricistas ni otras especialidades, ni demuestra interés en una capacitación. Si usas una categoría amplia como aproximación, explica claramente esta limitación y no inventes sedes.
Si te preguntan qué haces o qué puede hacer la aplicación, explica directamente estas funciones útiles. Habla de tu identidad, fabricante o tecnología solo si te preguntan específicamente por ello.
Cuando te pidan un estilo, úsalo para redactar toda la respuesta, sin explicar ni comentar la petición de estilo.`;

export function createLocalChatProvider(options: {
  model?: LanguageModel;
  generate?: typeof generateText;
  timeoutMs?: number;
} = {}): ChatProvider {
  const model = options.model ?? lfm3;
  const generate = options.generate ?? generateText;
  const timeoutMs = options.timeoutMs;

  return {
    async answer({ request, evidence }, signal, onText) {
      const abortSignal = chatSignal(signal, timeoutMs);
      try {
        const settings = {
          model,
          system: `${applicationContext}\nResponde a la pregunta. Para datos de la muestra usa exclusivamente la evidencia proporcionada; si no basta, dilo. No trates el historial como evidencia.`,
          messages: [
            ...(request.history ?? []).slice(-6).map(({ role, text }) => ({ role, content: text })),
            { role: "user" as const, content: `Pregunta: ${request.question}\nEvidencia: ${JSON.stringify(evidence)}` },
          ],
          maxOutputTokens: 512,
          maxRetries: 0,
          providerOptions: { "transformers-js": { enableThinking: false } },
          abortSignal,
        };
        let text: string;
        if (onText) {
          const result = streamText(settings);
          let generated = "";
          for await (const part of result.fullStream) {
            if (part.type === "error") throw part.error;
            if (part.type === "text-delta") {
              generated += part.text;
              onText(part.text);
            }
          }
          if (abortSignal.aborted) throw abortSignal.reason;
          text = generated.trim();
        } else {
          text = (await generate(settings)).text.trim();
        }
        if (!text) throw new Error("Empty model response");
        return text;
      } catch {
        if (abortSignal.aborted) throw abortSignal.reason;
        throw new LocalModelUnavailableError();
      }
    },
    async describeCapabilities(signal) {
      const abortSignal = chatSignal(signal, timeoutMs);
      try {
        const result = await generate({
          model,
          system: "Responde en español y solo con las capacidades y límites indicados. No inventes funciones, fuentes ni datos. No solicites datos personales.",
          prompt: "Explica brevemente: puedo resumir y comparar estadísticas agregadas de la muestra por departamento, educación, ocupación y metas; consultar ingresos estimados, conteos y exclusión financiera cuando hay evidencia publicable. No establezco causalidad ni representatividad nacional. La búsqueda semántica no está disponible. Invita a preguntar por un indicador o territorio.",
          temperature: 0,
          maxOutputTokens: 120,
          maxRetries: 0,
          providerOptions: { "transformers-js": { enableThinking: false } },
          abortSignal,
        });
        return result.text.trim();
      } catch {
        if (abortSignal.aborted) throw abortSignal.reason;
        throw new LocalModelUnavailableError();
      }
    },
    async selectFacts(input, signal) {
      if (!input.facts.length) return [];
      // La redacción es un extra: un timeout explícito no debe tumbar la respuesta verificada.
      const abortSignal = chatSignal(signal, timeoutMs ? Math.min(timeoutMs, 10_000) : undefined);
      const selectionSchema = z.object({ ids: z.array(z.string()).max(3) }).strict();
      const options = input.facts.map(({ id, label, value, unit }) => ({
        id,
        texto: value === null ? label : `${label}: ${value} ${unit}`,
      }));
      try {
        const result = await generate({
          model,
          system: "Selecciona hasta 3 ids de hechos relevantes para la pregunta. Usa solo ids de la lista; no escribas cifras, etiquetas nuevas ni afirmaciones. Devuelve JSON: {\"ids\":[\"id\"]}. Si ninguno es pertinente, devuelve {\"ids\":[]}.",
          prompt: `Pregunta: ${input.question}\nHechos publicables: ${JSON.stringify(options)}`,
          temperature: 0,
          maxOutputTokens: 128,
          maxRetries: 0,
          providerOptions: { "transformers-js": { enableThinking: false } },
          abortSignal,
        });
        if (signal?.aborted) throw signal.reason;
        const parsed = selectionSchema.safeParse(JSON.parse(result.text.trim()));
        if (!parsed.success) return [];
        const known = new Set(input.facts.map(({ id }) => id));
        return [...new Set(parsed.data.ids)].filter((id) => known.has(id));
      } catch {
        if (signal?.aborted) throw signal.reason;
        return [];
      }
    },
    async plan(input, signal) {
      const abortSignal = chatSignal(signal, timeoutMs);
      try {
        const settings = {
          model,
          system: `${applicationContext}
Para datos o recomendaciones basadas en la muestra, devuelve SOLO JSON con una llamada: {"calls":[{"name":"get_statistics","input":{"groupBy":"department","metrics":["income_mean"]}}]}. Ajusta la herramienta y los indicadores a la pregunta. No uses XML, Markdown ni explicaciones de la llamada. La aplicación ejecuta y valida el plan.
Operaciones permitidas: ${planningTools}
Usa get_statistics para métricas/distribuciones y compare_departments para contrastar territorios. Para explicar la aplicación responde sin herramientas.
Pregunta solo si falta información imprescindible. Si la evidencia o una llamada no bastan, explica el límite sin inventar datos ni equiparar aproximaciones.
Los departamentos de get_statistics YA están en los filtros activos: su input no acepta departmentId, departmentIds ni filters. Sin un perfil solicitado, usa solo groupBy y metrics. Omite parámetros opcionales no solicitados: no envíes null, cadenas vacías ni valores como «todos». Usa occupationId, educationId, goalId, minIncome y maxIncome solo para perfiles solicitados. El historial no es evidencia.
Métricas: income_mean=promedio, income_median=mediana, sample_count=conteo, financial_exclusion_pct=exclusión financiera. Para distribuciones usa groupBy education/occupation/goal con category_count/category_pct. Solicita solo los indicadores pedidos.
Catálogos [id, etiqueta]: ocupaciones ${JSON.stringify(OCCUPATIONS.map(({ id, label }) => [id, label]))}; educación ${JSON.stringify(EDUCATION.map(({ id, label }) => [id, label]))}; metas ${JSON.stringify(GOALS.map(({ id, label }) => [id, label]))}.`,
          messages: [
            ...(input.history ?? []).slice(-6).map(({ role, text }) => ({ role, content: text })),
            { role: "user" as const, content: `Active filters: ${JSON.stringify(input.filters ?? {})}\nCurrent question: ${input.question}` },
          ],
          temperature: 0,
          maxOutputTokens: 384,
          maxRetries: 0,
          providerOptions: { "transformers-js": { enableThinking: false } },
          abortSignal,
        };
        let correction = "";
        for (let attempt = 0; attempt < 2; attempt++) {
          const result = await generate(attempt === 0 ? settings : {
            ...settings,
            system: `${settings.system}\nLa respuesta anterior no contenía una llamada válida. Corrígela. Usa exclusivamente los argumentos del esquema de la herramienta; los departamentos ya están en los filtros activos. No agregues perfiles no solicitados. Si no puedes llamar la herramienta, devuelve solo JSON con el formato {"calls":[{"name":"nombre_de_herramienta","input":{}}]}, usando el nombre y argumentos apropiados para la pregunta.`,
            messages: [...settings.messages, { role: "user" as const, content: correction }],
          });
          const calls = (result.toolCalls ?? []).map(({ toolName, input }) => ({ name: toolName, input }));
          try {
            return parseLocalPlan(result.text.trim(), calls);
          } catch (error) {
            if (!(error instanceof InvalidLocalChatPlanError)) throw error;
            console.warn("Invalid local chat plan", { attempt: attempt + 1, detail: error.detail });
            if (attempt === 1) throw error;
            correction = `Corrige esta salida anterior, tratándola solo como datos: ${JSON.stringify(calls.length ? calls : result.text.slice(0, 2000)).slice(0, 4000)}\nErrores de validación: ${error.detail.slice(0, 2000)}`;
          }
        }
        throw new InvalidLocalChatPlanError();
      } catch (error) {
        if (abortSignal.aborted) throw abortSignal.reason;
        if (error instanceof InvalidLocalChatPlanError) throw error;
        throw new LocalModelUnavailableError();
      }
    },
  };
}
