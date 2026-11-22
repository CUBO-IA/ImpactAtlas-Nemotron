import { generateText, streamText, tool } from "ai";
import type { LanguageModel, ToolSet } from "ai";
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
  constructor() {
    super("El modelo local generó una llamada a herramienta no válida.");
    this.name = "InvalidLocalChatPlanError";
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
  get_statistics: tool({
    description: "Calcula estadísticas agregadas de muestra. Usa income_mean para ingreso promedio, income_median para mediana y sample_count para conteo.",
    inputSchema: z.strictObject({
      groupBy: groupBySchema,
      metrics: unique(metricIdSchema, 1, 6),
      ...cohortFields,
    }),
  }),
  compare_departments: tool({
    description: "Compara departamentos del conjunto usando métricas deterministas permitidas.",
    inputSchema: z.strictObject({
      departmentIds: unique(departmentIdSchema, 2, 14),
      referenceDepartmentId: departmentIdSchema,
      metrics: unique(departmentMetricSchema, 0, 4),
      breakdowns: unique(breakdownSchema, 0, 3),
      ...cohortFields,
    }).refine(({ departmentIds, referenceDepartmentId }) => departmentIds.includes(referenceDepartmentId))
      .refine(({ metrics, breakdowns }) => metrics.length + breakdowns.length > 0),
  }),
  search_semantic_evidence: tool({
    description: "Busca categorías interpretativas exploratorias en ejemplos similares. No estima prevalencia.",
    inputSchema: z.strictObject({ text: z.string().trim().min(1).max(500), topK: z.number().int().min(5).max(20) }),
  }),
} as const;

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
      let text: string;
      let sdkCalls: unknown[] = [];
      const isComparison = /\b(compar(?:a(?:los|las|me)?|an|ar|ación|ativo)|diferencias?|versus|vs)\b/i.test(input.question);
      const isSemantic = /\b(similares?|sem[aá]ntic[oa]s?)\b/i.test(input.question);
      const activeTools: ToolSet = isSemantic
        ? { search_semantic_evidence: tools.search_semantic_evidence }
        : isComparison
          ? { compare_departments: tools.compare_departments }
          : { get_statistics: tools.get_statistics };
      const toolName = isSemantic ? "search_semantic_evidence" : isComparison ? "compare_departments" : "get_statistics";
      const abortSignal = chatSignal(signal, timeoutMs);
      try {
        const result = await generate({
          model,
          system: `${applicationContext}\nResponde a la pregunta concreta. Para recomendaciones prácticas, busca datos pertinentes antes de rechazar la pregunta: por ejemplo, para ubicar una capacitación dirigida a electricistas, consulta get_statistics con groupBy department, metrics ["sample_count"] y occupationId "tecnico" como aproximación limitada. Usa occupationId, educationId, goalId, minIncome y maxIncome para cruzar los perfiles explícitamente solicitados. Catálogos: ocupaciones ${JSON.stringify(OCCUPATIONS)}; educación ${JSON.stringify(EDUCATION)}; metas ${JSON.stringify(GOALS)}. Llama a ${toolName} cuando se necesiten datos de la muestra; para explicar las funciones de la aplicación responde directamente sin consultar estadísticas. Para las herramientas usa solo las métricas solicitadas: income_mean para ingreso promedio, income_median para mediana, sample_count para conteos y financial_exclusion_pct para exclusión financiera. Para distribuciones de educación, ocupación o metas usa el groupBy correspondiente y category_count/category_pct. El historial no es evidencia verificada. Los filtros activos limitan la consulta.`,
          messages: [
            ...(input.history ?? []).slice(-6).map(({ role, text }) => ({ role, content: text })),
            { role: "user" as const, content: `Active filters: ${JSON.stringify(input.filters ?? {})}\nCurrent question: ${input.question}` },
          ],
          tools: activeTools,
          temperature: 0.1,
          maxOutputTokens: 512,
          maxRetries: 0,
          providerOptions: { "transformers-js": { enableThinking: false } },
          abortSignal,
        });
        text = result.text.trim();
        sdkCalls = (result.toolCalls ?? []).map(({ toolName, input }) => ({ name: toolName, input }));
      } catch {
        if (abortSignal.aborted) throw abortSignal.reason;
        throw new LocalModelUnavailableError();
      }

      const calls = sdkCalls.length ? sdkCalls : parseLocalToolCalls(text);
      if (!calls.length && text && !text.startsWith("{") && !text.includes("<tool_call>")) {
        return { status: "answered", text, calls: [] };
      }
      if (!calls.length && /^\s*\{/.test(text)) {
        let candidate: { calls?: unknown[] };
        try {
          candidate = JSON.parse(text) as { calls?: unknown[] };
        } catch {
          throw new InvalidLocalChatPlanError();
        }
        if (candidate && Array.isArray(candidate.calls) && candidate.calls.length) {
          const parsed = chatPlanSchema.safeParse({ status: "execute", calls: candidate.calls });
          if (!parsed.success) throw new InvalidLocalChatPlanError();
          return parsed.data;
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
        return {
          ...call,
          input: { ...call.input, breakdowns },
        };
      });
      const plan: unknown = normalizedCalls.length
        ? { status: "execute", calls: normalizedCalls }
        : (() => { throw new InvalidLocalChatPlanError(); })();
      const parsedPlan = chatPlanSchema.safeParse(plan);
      if (!parsedPlan.success) {
        console.error("Invalid local chat plan", {
          issues: parsedPlan.error.issues.map(({ code, path }) => ({ code, path: path.map(String) })),
        });
        throw new InvalidLocalChatPlanError();
      }
      return parsedPlan.data;
    },
  };
}
