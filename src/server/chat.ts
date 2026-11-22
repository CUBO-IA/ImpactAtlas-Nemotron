import type { ChatRequest, ChatResponse, ChartSpec } from "../contracts/chat.ts";
import { compareRequestSchema, type CompareRequest, type CompareResponse } from "../contracts/compare.ts";
import type { Filters } from "../contracts/common.ts";
import { statisticsRequestSchema, type StatisticsRequest, type StatisticsResponse } from "../contracts/statistics.ts";
import { chatPlanSchema } from "../ai/tools.ts";
import { searchSemanticForChat } from "../ai/semantic.ts";
import { getChatProvider, type ToolCall } from "../ai/provider.ts";
import { DEPARTMENTS } from "../lib/catalog-data.ts";

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

function mentionedDepartments(question: string) {
  const normalized = question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return DEPARTMENTS.filter(({ id }) => new RegExp(`\\b${id.replaceAll("-", "\\s+")}\\b`).test(normalized))
    .map(({ id }) => id);
}

type ChartUnit = ChartSpec["series"][number]["unit"];

const chartUnitLabels: Record<ChartUnit, string> = {
  records: "Registros",
  usd_estimated: "USD estimados",
  percent: "Porcentaje",
  percentage_points: "Puntos porcentuales",
};

const chartUnits = new Set<string>(Object.keys(chartUnitLabels));

/** Gráficos con los mismos hechos publicables de la tabla, agrupados por unidad (máx. 2 paneles). */
function chartBlocks(item: ChatEvidence): ChatData["blocks"] {
  const byUnit = new Map<ChartUnit, ChatEvidence["facts"]>();
  for (const fact of item.facts) {
    if (fact.value === null || !chartUnits.has(fact.unit)) continue;
    const unit = fact.unit as ChartUnit;
    const group = byUnit.get(unit) ?? [];
    group.push(fact);
    byUnit.set(unit, group);
  }
  const groups = [...byUnit.entries()]
    .filter(([, facts]) => facts.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 2);
  return groups.map(([unit, facts]) => {
    const selected = facts.slice(0, 30);
    return {
      type: "chart" as const,
      chart: {
        type: "bar" as const,
        title: `${chartUnitLabels[unit]} — muestra publicable`,
        categories: selected.map((fact) => fact.label),
        series: [{
          name: chartUnitLabels[unit],
          values: selected.map((fact) => fact.value),
          unit,
        }],
        evidenceIds: [item.id],
      },
    };
  });
}

async function buildBlocks(
  evidence: readonly ChatEvidence[],
  request: ChatRequest,
  provider: NonNullable<ReturnType<typeof getChatProvider>>,
  signal?: AbortSignal,
  onBlock?: (block: ChatData["blocks"][number]) => void,
  onText?: (text: string) => void,
): Promise<ChatData["blocks"]> {
  const blocks: ChatData["blocks"] = [];
  const add = (...items: ChatData["blocks"]) => {
    blocks.push(...items);
    items.forEach((item) => onBlock?.(item));
  };
  const questionText = request.question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const textOnly = /\b(?:solo|solamente|unicamente)\s+(?:en\s+)?(?:texto|palabras)\b|\ben\s+(?:prosa|texto\s+plano)\b/.test(questionText);
  const allowsTable = !textOnly
    && !/\b(?:sin(?:\s+usar)?|evita|nada\s+de|no(?:\s+(?:quiero|incluyas|muestres|uses))?)\s+(?:una\s+)?(?:tablas?|cuadros?)\b/.test(questionText);
  const wantsTable = allowsTable && /\b(?:tablas?|tabular|desglose|desglosa)\b/.test(questionText);
  const wantsChart = !textOnly
    && !/\b(?:sin(?:\s+usar)?|evita|nada\s+de|no(?:\s+(?:quiero|incluyas|muestres|uses))?)\s+(?:un\s+)?grafic[oa]s?\b/.test(questionText)
    && /\b(?:grafic[oa]s?|barras|visualizacion)\b/.test(questionText);
  const usableEvidence = evidence.filter((item) => item.kind === "sql_aggregate" ? item.facts.length > 0 : !item.description.includes("deshabilitada"));
  if (!usableEvidence.length) return blocks;
  const text = await provider.answer({ request, evidence: usableEvidence }, signal, onText);
  if (!text.trim()) throw new Error("El modelo devolvió una respuesta vacía.");
  const textBlock = { type: "text" as const, text, evidenceIds: usableEvidence.map(({ id }) => id) };
  blocks.push(textBlock);
  if (!onText) onBlock?.(textBlock);
  for (const item of evidence) {
    if (item.kind === "semantic_examples") {
      continue;
    }
    if (!item.facts.length) continue;
    const showTable = wantsTable || (allowsTable
      && item.description.startsWith("Comparación territorial")
      && item.facts.length > 6);
    if (showTable) {
      for (let offset = 0; offset < item.facts.length; offset += 30) {
        add({
          type: "table",
          title: "Detalle de los datos consultados",
          columns: ["Indicador", "Valor", "Unidad"],
          rows: item.facts.slice(offset, offset + 30).map(({ label, value, unit }) => [label, value, unit]),
          evidenceIds: [item.id],
        });
      }
    }
    if (wantsChart) add(...chartBlocks(item));
  }
  return blocks;
}

async function executeTool(
  call: ToolCall,
  request: ChatRequest,
  adapter: ChatServices,
  id: string,
): Promise<ChatEvidence> {
  const filters = request.filters ?? {};
  if (call.name === "get_statistics") {
    const { occupationId, educationId, goalId, minIncome, maxIncome, ...input } = call.input;
    const appliedFilters = cohortFilters(filters, { occupationId, educationId, goalId, minIncome, maxIncome })!;
    const parsed = statisticsRequestSchema.safeParse({ ...input, filters: appliedFilters });
    if (!parsed.success) throw new Error("Invalid statistics tool arguments");
    return statisticsEvidence(await adapter.getStatistics(parsed.data), appliedFilters, id);
  }
  if (call.name === "compare_departments") {
    const { occupationId, educationId, goalId, minIncome, maxIncome, ...input } = call.input;
    const comparisonFilters = cohortFilters(filters, { occupationId, educationId, goalId, minIncome, maxIncome })!;
    delete comparisonFilters.departmentIds;
    const parsed = compareRequestSchema.safeParse({ ...input, filters: comparisonFilters });
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

function cohortFilters(filters: Filters, input: {
  occupationId?: string; educationId?: string; goalId?: string; minIncome?: number; maxIncome?: number;
}): Filters | null {
  const result: Filters = { ...filters };
  for (const [key, value] of [
    ["occupationIds", input.occupationId],
    ["educationIds", input.educationId],
    ["goalIds", input.goalId],
  ] as const) {
    if (!value) continue;
    if (filters[key] && !filters[key].includes(value)) return null;
    result[key] = [value];
  }
  if (input.minIncome !== undefined || input.maxIncome !== undefined) {
    const min = Math.max(filters.income?.min ?? 0, input.minIncome ?? 0);
    const max = Math.min(filters.income?.max ?? Infinity, input.maxIncome ?? Infinity);
    if (min > max) return null;
    result.income = { min, ...(Number.isFinite(max) ? { max } : {}) };
  }
  return result;
}

export function createChatOrchestrator(
  dependencies: {
    provider: NonNullable<ReturnType<typeof getChatProvider>>;
    services: ChatServices;
    onStage?: (stage: "provider-plan" | "statistics" | "compare" | "semantic" | "answer" | "metadata") => void;
    onBlock?: (block: ChatData["blocks"][number]) => void;
    onText?: (text: string) => void;
  },
) {
  return async function orchestrate(request: ChatRequest, signal?: AbortSignal): Promise<ChatData> {
    const question = request.question.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let departmentIds = mentionedDepartments(request.question);
    if (!departmentIds.length && /^(?:[¿¡\s]*(?:y|ahora|tambien|si|muestrame|dame|haz|pon|presenta)\b)|\ben\s+(?:una\s+)?tabla\b/.test(question)) {
      const previousQuestion = request.history?.findLast(({ role }) => role === "user")?.text;
      if (previousQuestion) departmentIds = mentionedDepartments(previousQuestion);
    }
    const activeDepartments = request.filters?.departmentIds;
    if (activeDepartments && departmentIds.some((id) => !activeDepartments.includes(id))) {
      return {
        status: "needs_clarification",
        blocks: [{ type: "text", text: "El departamento que mencionas no coincide con el filtro territorial activo. Ajusta el filtro para consultar ese territorio.", evidenceIds: [] }],
        evidence: [],
        toolsUsed: [],
      };
    }
    const scopedRequest = departmentIds.length
      ? { ...request, filters: { ...request.filters, departmentIds } }
      : request;
    dependencies.onStage?.("provider-plan");
    const plan = chatPlanSchema.parse(await dependencies.provider.plan(scopedRequest, signal));
    if (plan.status === "answered") {
      return { status: "answered", blocks: [{ type: "text", text: plan.text, evidenceIds: [] }], evidence: [], toolsUsed: [] };
    }
    if (plan.status === "needs_clarification") {
      return {
        status: "needs_clarification",
        blocks: [{
          type: "text",
          text: plan.question,
          evidenceIds: [],
        }],
        evidence: [],
        toolsUsed: [],
      };
    }
    const selectedDepartments = scopedRequest.filters?.departmentIds;
    if (plan.calls.some((call) => call.name !== "search_semantic_evidence"
      && !cohortFilters(scopedRequest.filters ?? {}, call.input))) {
      return {
        status: "needs_clarification",
        blocks: [{ type: "text", text: "El perfil solicitado no coincide con los filtros activos. Ajusta los filtros para continuar.", evidenceIds: [] }],
        evidence: [],
        toolsUsed: [],
      };
    }
    if (plan.calls.some((call) => call.name === "get_statistics"
      && !statisticsRequestSchema.safeParse({ groupBy: call.input.groupBy, metrics: call.input.metrics, filters: scopedRequest.filters ?? {} }).success)) {
      return {
        status: "needs_clarification",
        blocks: [{ type: "text", text: "No pude combinar ese indicador con el desglose solicitado. Prueba preguntando por ingresos por departamento o por la distribución de educación, ocupación o metas.", evidenceIds: [] }],
        evidence: [],
        toolsUsed: [],
      };
    }
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
      dependencies.onStage?.(call.name === "get_statistics" ? "statistics"
        : call.name === "compare_departments" ? "compare" : "semantic");
      evidence.push(await executeTool(call, scopedRequest, dependencies.services, `ev-${index + 1}`));
    }
    dependencies.onStage?.("answer");
    const blocks = await buildBlocks(evidence, request, dependencies.provider, signal, dependencies.onBlock, dependencies.onText);
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

export async function handleChat(
  request: ChatRequest,
  requestId: string,
  callerSignal?: AbortSignal,
  onStage?: (stage: "provider-plan" | "statistics" | "compare" | "semantic" | "answer" | "metadata") => void,
  onBlock?: (block: ChatData["blocks"][number]) => void,
  onText?: (text: string) => void,
): Promise<ChatResponse> {
  const provider = getChatProvider();
  if (!provider) throw new Error("Approved chat provider is not configured");
  const adapters = services ?? {
    ...(await import("./chat-services.ts")).createChatServices(),
    async searchSemanticEvidence(input: { text: string; filters: Filters; topK: number }) {
      const { getCatalog } = await import("./data-service.ts");
      return searchSemanticForChat(input.text, await getCatalog(), input.filters, input.topK);
    },
  };
  const data = await createChatOrchestrator({ provider, services: adapters, onStage, onBlock, onText })(request, callerSignal);
  const evidenceFilters = data.evidence[0]?.filters;
  const sameEvidenceFilters = evidenceFilters
    && data.evidence.every((item) => JSON.stringify(item.filters) === JSON.stringify(evidenceFilters));
  onStage?.("metadata");
  return {
    data,
    meta: await adapters.getMetadata(requestId, sameEvidenceFilters ? evidenceFilters : request.filters ?? {}),
  };
}
