import type { ChatRequest, ChatResponse } from "../contracts/chat.ts";
import { compareRequestSchema, type CompareRequest, type CompareResponse } from "../contracts/compare.ts";
import type { Filters } from "../contracts/common.ts";
import { statisticsRequestSchema, type StatisticsRequest, type StatisticsResponse } from "../contracts/statistics.ts";
import { chatPlanSchema } from "../ai/tools.ts";
import { searchSemanticForChat } from "../ai/semantic.ts";
import { getChatProvider, type ToolCall } from "../ai/provider.ts";

export type ChatData = ChatResponse["data"];
export type ChatEvidence = ChatData["evidence"][number];

export interface ChatServices {
  getStatistics(request: StatisticsRequest): Promise<StatisticsResponse>;
  compareDepartments(request: CompareRequest): Promise<CompareResponse>;
  getMetadata(requestId: string, filters: Filters): Promise<ChatResponse["meta"]>;
  searchSemanticEvidence?(input: { text: string; filters: Filters; topK: number }): Promise<
    | { status: "ok"; interpretation: "exploratory_not_prevalence"; categories: string[] }
    | { status: "abstained"; reason: string }
  >;
}

let services: ChatServices | undefined;

/** Statistics/search adapters register only when their real service is ready. */
export function configureChatServices(value: ChatServices | undefined) {
  services = value;
}

const metricLabel: Record<string, string> = {
  sample_count: "Registros de la muestra",
  income_mean: "Ingreso promedio estimado (USD)",
  income_median: "Mediana de ingreso estimado (USD)",
  financial_exclusion_pct: "Sin acceso financiero (%)",
  category_count: "Registros por categoría",
  category_pct: "Porcentaje por categoría",
};

function statisticsEvidence(result: StatisticsResponse, filters: Filters, id: string): ChatEvidence {
  const facts = result.data.rows.flatMap((row) => Object.entries(row.metrics).flatMap(([metric, value]) => {
    if (!value || value.suppressed || value.value === null) return [];
    return [{
      id: `${id}-${row.key}-${metric}`,
      label: `${row.label}: ${metricLabel[metric] ?? metric}`,
      value: value.value,
      unit: value.unit,
    }];
  }));
  return {
    id,
    kind: "sql_aggregate",
    description: `Agregados de ${result.data.groupBy} para los filtros aplicados.`,
    filters,
    sampleSize: result.meta.sampleSize !== null && result.meta.sampleSize >= 5 ? result.meta.sampleSize : null,
    exhaustive: true,
    facts,
  };
}

function comparisonEvidence(result: CompareResponse, filters: Filters, id: string): ChatEvidence {
  const facts = result.data.departments.flatMap((department) => [
    ...Object.entries(department.metrics).flatMap(([metric, value]) => {
      if (!value || value.suppressed || value.value === null) return [];
      return [{
        id: `${id}-${department.id}-${metric}`,
        label: `${department.label}: ${metricLabel[metric] ?? metric}`,
        value: value.value,
        unit: value.unit,
      }];
    }),
    ...department.differences.flatMap(({ metricId, value, unit }) => value === null ? [] : [{
      id: `${id}-${department.id}-${metricId}-difference`,
      label: `${department.label} menos referencia: ${metricLabel[metricId] ?? metricId}`,
      value,
      unit,
    }]),
  ]);
  return {
    id,
    kind: "sql_aggregate",
    description: `Comparación territorial respecto a ${result.data.referenceDepartmentId}.`,
    filters,
    sampleSize: null,
    exhaustive: true,
    facts,
  };
}

function unsupportedQuestion(question: string) {
  return /\b(caus(?:a|al|alidad)|provoc(?:a|ar)|efecto\s+de|impacto\s+de|por\s+qu[eé]|debido\s+a|influye|afecta|determina|explica(?:n)?|representativ(?:o|a|idad)|poblaci[oó]n\s+(?:nacional|salvadoreña)|predic(?:e|ci[oó]n)|proyect(?:a|ar))\b/i.test(question);
}

function deterministicBlocks(evidence: readonly ChatEvidence[]): ChatData["blocks"] {
  return evidence.flatMap((item): ChatData["blocks"] => {
    if (item.kind === "semantic_examples") {
      if (item.description.startsWith("La búsqueda semántica está deshabilitada")) return [];
      return [{
        type: "text",
        text: item.description,
        evidenceIds: [item.id],
      }];
    }
    if (!item.facts.length) return [];
    const facts = item.facts;
    const blocks: ChatData["blocks"] = [];
    for (let offset = 0; offset < facts.length; offset += 30) {
      blocks.push({
        type: "table",
        title: "Agregados publicables de la muestra",
        columns: ["Indicador", "Valor", "Unidad"],
        rows: facts.slice(offset, offset + 30).map(({ label, value, unit }) => [label, value, unit]),
        evidenceIds: [item.id],
      });
    }
    return blocks;
  });
}

function abstention(text: string): ChatData {
  return {
    status: "insufficient_evidence",
    blocks: [{ type: "text", text, evidenceIds: [] }],
    evidence: [],
    toolsUsed: [],
  };
}

async function executeTool(
  call: ToolCall,
  request: ChatRequest,
  adapter: ChatServices,
  id: string,
): Promise<ChatEvidence> {
  const filters = request.filters ?? {};
  if (call.name === "get_statistics") {
    const parsed = statisticsRequestSchema.safeParse({ ...call.input, filters });
    if (!parsed.success) throw new Error("Invalid statistics tool arguments");
    return statisticsEvidence(await adapter.getStatistics(parsed.data), filters, id);
  }
  if (call.name === "compare_departments") {
    const comparisonFilters = { ...filters };
    delete comparisonFilters.departmentIds;
    const parsed = compareRequestSchema.safeParse({ ...call.input, filters: comparisonFilters });
    if (!parsed.success) throw new Error("Invalid comparison tool arguments");
    const result = await adapter.compareDepartments(parsed.data);
    const appliedFilters = { ...comparisonFilters, departmentIds: [...parsed.data.departmentIds].sort() };
    return comparisonEvidence(result, appliedFilters, id);
  }
  if (!adapter.searchSemanticEvidence) {
    return {
      id,
      kind: "semantic_examples",
      description: "La búsqueda semántica está deshabilitada; no se puede ofrecer una interpretación.",
      filters,
      sampleSize: null,
      exhaustive: false,
      facts: [],
    };
  }
  const result = await adapter.searchSemanticEvidence({ ...call.input, filters });
  return {
    id,
    kind: "semantic_examples",
    description: result.status === "ok" && result.categories.length
      ? `Exploración cualitativa de categorías similares: ${[...result.categories].sort().join(", ")}. Es una interpretación exploratoria, no una medición de prevalencia.`
      : "La búsqueda semántica está deshabilitada o no hay categorías publicables; no se puede ofrecer una interpretación.",
    filters,
    sampleSize: null,
    exhaustive: false,
    facts: [],
  };
}

export function createChatOrchestrator(
  dependencies: { provider: NonNullable<ReturnType<typeof getChatProvider>>; services: ChatServices },
) {
  return async function orchestrate(request: ChatRequest, signal?: AbortSignal): Promise<ChatData> {
    if (/^(?:hola|saludos|buenos días|buenas tardes|buenas noches)[\s!.¿?]*$/i.test(request.question.trim())) {
      return {
        status: "needs_clarification",
        blocks: [{ type: "text", text: "¿Qué indicador deseas consultar y para qué alcance territorial?", evidenceIds: [] }],
        evidence: [],
        toolsUsed: [],
      };
    }
    if (unsupportedQuestion(request.question)) {
      return abstention("La muestra solo permite análisis descriptivos; no puede establecer causalidad, representatividad nacional ni predicciones.");
    }
    const plan = chatPlanSchema.parse(await dependencies.provider.plan(request, signal));
    if (plan.status === "needs_clarification") {
      return {
        status: "needs_clarification",
        blocks: [{
          type: "text",
          text: "¿Qué indicador deseas consultar y para qué alcance territorial?",
          evidenceIds: [],
        }],
        evidence: [],
        toolsUsed: [],
      };
    }
    const selectedDepartments = request.filters?.departmentIds;
    const compareScopeChanged = selectedDepartments && plan.calls.some((call) =>
      call.name === "compare_departments"
      && (selectedDepartments.length !== call.input.departmentIds.length
        || selectedDepartments.some((id) => !call.input.departmentIds.includes(id))),
    );
    if (compareScopeChanged) {
      return {
        status: "needs_clarification",
        blocks: [{
          type: "text",
          text: "Los departamentos solicitados no coinciden con el filtro territorial activo. Ajusta el filtro o la comparación.",
          evidenceIds: [],
        }],
        evidence: [],
        toolsUsed: [],
      };
    }
    const evidence: ChatEvidence[] = [];
    for (const [index, call] of plan.calls.entries()) {
      evidence.push(await executeTool(call, request, dependencies.services, `ev-${index + 1}`));
    }
    const blocks = deterministicBlocks(evidence);
    if (!blocks.length) {
      return {
        status: "insufficient_evidence",
        blocks: [{
          type: "text",
          text: evidence.some((item) => item.kind === "semantic_examples"
            && item.description === "La búsqueda semántica está deshabilitada; no se puede ofrecer una interpretación.")
            ? "La búsqueda semántica está deshabilitada; no se puede ofrecer una interpretación."
            : "No hay evidencia publicable para responder con los filtros indicados.",
          evidenceIds: [],
        }],
        evidence,
        toolsUsed: plan.calls.map(({ name }) => name),
      };
    }
    return {
      status: "answered",
      blocks,
      evidence,
      toolsUsed: plan.calls.map(({ name }) => name),
    };
  };
}

export async function handleChat(request: ChatRequest, requestId: string, callerSignal?: AbortSignal): Promise<ChatResponse> {
  const provider = getChatProvider();
  if (!provider) throw new Error("Approved chat provider is not configured");
  const adapters = services ?? {
    ...(await import("./chat-services.ts")).createChatServices(),
    async searchSemanticEvidence(input: { text: string; filters: Filters; topK: number }) {
      const { getCatalog } = await import("./data-service.ts");
      return searchSemanticForChat(input.text, await getCatalog(), input.filters, input.topK);
    },
  };
  const data = await createChatOrchestrator({ provider, services: adapters })(request, callerSignal);
  const evidenceFilters = data.evidence[0]?.filters;
  const sameEvidenceFilters = evidenceFilters
    && data.evidence.every((item) => JSON.stringify(item.filters) === JSON.stringify(evidenceFilters));
  return {
    data,
    meta: await adapters.getMetadata(requestId, sameEvidenceFilters ? evidenceFilters : request.filters ?? {}),
  };
}
