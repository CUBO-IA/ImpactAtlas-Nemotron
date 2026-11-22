import { generateText, tool } from "ai";
import type { LanguageModel, ToolSet } from "ai";
import { z } from "zod";
import type { ChatRequest } from "../contracts/chat.ts";
import {
  breakdownSchema,
  departmentIdSchema,
  departmentMetricSchema,
  groupBySchema,
  metricIdSchema,
  unique,
} from "../contracts/common.ts";
import { chatPlanSchema } from "./tools.ts";
import { lfm3 } from "./lfm3.ts";

export const LOCAL_CHAT_TIMEOUT_MS = 75_000;

export type ToolCall =
  | {
      name: "get_statistics";
      input: { groupBy: "department" | "education" | "occupation" | "goal"; metrics: string[] };
    }
  | { name: "compare_departments"; input: { departmentIds: string[]; referenceDepartmentId: string; metrics: string[]; breakdowns: string[] } }
  | { name: "search_semantic_evidence"; input: { text: string; topK: number } };

export type ChatPlan =
  | { status: "needs_clarification"; question: string; calls: [] }
  | { status: "execute"; calls: ToolCall[] };

export interface ChatProvider {
  plan(input: Pick<ChatRequest, "question" | "history" | "filters">, signal?: AbortSignal): Promise<unknown>;
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
    }),
  }),
  compare_departments: tool({
    description: "Compara departamentos del conjunto usando métricas deterministas permitidas.",
    inputSchema: z.strictObject({
      departmentIds: unique(departmentIdSchema, 2, 14),
      referenceDepartmentId: departmentIdSchema,
      metrics: unique(departmentMetricSchema, 0, 4),
      breakdowns: unique(breakdownSchema, 0, 3),
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

export function createLocalChatProvider(options: {
  model?: LanguageModel;
  generate?: typeof generateText;
  timeoutMs?: number;
} = {}): ChatProvider {
  const model = options.model ?? lfm3;
  const generate = options.generate ?? generateText;
  const timeoutMs = options.timeoutMs ?? LOCAL_CHAT_TIMEOUT_MS;

  return {
    async plan(input, signal) {
      let text: string;
      let sdkCalls: unknown[] = [];
      const isComparison = /\b(compar(?:a|an|ar|ación|ativo)|diferencias?|versus|vs)\b/i.test(input.question);
      const isSemantic = /\b(metas?|temas?|categor[ií]as?|similares?|sem[aá]ntic[oa]s?|explor(?:a|ar|aci[oó]n))\b/i.test(input.question);
      const activeTools: ToolSet = isSemantic
        ? { search_semantic_evidence: tools.search_semantic_evidence }
        : isComparison
          ? { compare_departments: tools.compare_departments }
          : { get_statistics: tools.get_statistics };
      const toolName = isSemantic ? "search_semantic_evidence" : isComparison ? "compare_departments" : "get_statistics";
      const abortSignal = signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : AbortSignal.timeout(timeoutMs);
      try {
        const result = await generate({
          model,
          system: `You must call ${toolName}. Do not explain. Never invent arguments, counts or results.`,
          prompt: `${input.question}. Call ${toolName} now.`,
          tools: activeTools,
          temperature: 0.1,
          maxOutputTokens: 256,
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
      if (!calls.length && /^\s*\{/.test(text)) {
        const candidate = JSON.parse(text) as { calls?: unknown[] };
        if (candidate && Array.isArray(candidate.calls) && candidate.calls.length) {
          return chatPlanSchema.parse({ status: "execute", calls: candidate.calls });
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
        : { status: "needs_clarification", question: "Se necesita precisar la consulta.", calls: [] };
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
