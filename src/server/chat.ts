import type { ChatRequest, ChatResponse, ChartSpec } from "../contracts/chat.ts";
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

const unitLabel: Record<string, string> = {
  usd_estimated: " USD estimados",
  percent: "%",
  records: " registros",
  percentage_points: " puntos porcentuales",
};

/** Toda cifra del texto sale de un hecho publicable; el modelo solo elige cuáles destacar. */
function factSentence(fact: ChatEvidence["facts"][number]): string {
  if (fact.value === null) return `${fact.label}: sin valor publicable.`;
  const value = fact.value.toLocaleString("es-SV", { maximumFractionDigits: 2 });
  return `${fact.label}: ${value}${unitLabel[fact.unit] ?? ` ${fact.unit}`}.`;
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
  question: string,
  provider: NonNullable<ReturnType<typeof getChatProvider>>,
  signal?: AbortSignal,
): Promise<ChatData["blocks"]> {
  const blocks: ChatData["blocks"] = [];
  for (const item of evidence) {
    if (item.kind === "semantic_examples") {
      if (!item.description.startsWith("La búsqueda semántica está deshabilitada")) {
        blocks.push({ type: "text", text: item.description, evidenceIds: [item.id] });
      }
      continue;
    }
    if (!item.facts.length) continue;
    for (let offset = 0; offset < item.facts.length; offset += 30) {
      blocks.push({
        type: "table",
        title: "Agregados publicables de la muestra",
        columns: ["Indicador", "Valor", "Unidad"],
        rows: item.facts.slice(offset, offset + 30).map(({ label, value, unit }) => [label, value, unit]),
        evidenceIds: [item.id],
      });
    }
    let sentences: string[] = [];
    if (provider.selectFacts) {
      const ids = await provider.selectFacts({ question, facts: item.facts }, signal);
      if (signal?.aborted) throw signal.reason;
      const byId = new Map(item.facts.map((fact) => [fact.id, fact]));
      sentences = ids.flatMap((id) => byId.has(id) ? [factSentence(byId.get(id)!)] : []);
    }
    blocks.push(...chartBlocks(item));
    blocks.push({
      type: "text",
      text: sentences.length
        ? `${sentences.join(" ")} Esta respuesta es descriptiva y se limita a los hechos publicables de la muestra; no establece causalidad ni representatividad nacional.`
        : `${item.description} La respuesta es descriptiva y se limita a los datos publicables de la muestra; no establece causalidad ni representatividad nacional.`,
      evidenceIds: [item.id],
    });
  }
  return blocks;
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
  dependencies: {
    provider: NonNullable<ReturnType<typeof getChatProvider>>;
    services: ChatServices;
    onStage?: (stage: "provider-plan" | "statistics" | "compare" | "semantic" | "metadata") => void;
  },
) {
  return async function orchestrate(request: ChatRequest, signal?: AbortSignal): Promise<ChatData> {
    if (/\b(?:qu[eé])\b.{0,40}\b(?:puedes|sabes)\b.{0,40}\b(?:responder|decir(?:me)?|consultar|ayudar)\b/i.test(request.question)) {
      dependencies.onStage?.("provider-plan");
      const text = await dependencies.provider.describeCapabilities?.(signal)
        ?? "Puedo resumir y comparar estadísticas agregadas publicables de la muestra por departamento, educación, ocupación y metas. Puedo consultar ingresos estimados, conteos y exclusión financiera cuando hay evidencia suficiente. No establezco causalidad ni representatividad nacional, y la búsqueda semántica no está disponible.";
      return {
        status: "answered",
        blocks: [{ type: "text", text, evidenceIds: [] }],
        evidence: [],
        toolsUsed: [],
      };
    }
    if (/^(?:hola|saludos|buenos días|buenas tardes|buenas noches)[\s!.¿?]*$/i.test(request.question.trim())) {
      return {
        status: "needs_clarification",
        blocks: [{ type: "text", text: "¿Qué indicador deseas consultar y para qué alcance territorial?", evidenceIds: [] }],
        evidence: [],
        toolsUsed: [],
      };
    }
    if (/\bcapacitaci[oó]n\b.*\b(?:electricistas?|instalar|paneles?\s+solares?)\b/i.test(request.question)) {
      return abstention("La muestra contiene únicamente datos socioeconómicos agregados; no incluye información sobre lugares o capacitaciones para instalar paneles solares.");
    }
    if (unsupportedQuestion(request.question)) {
      return abstention("La muestra solo permite análisis descriptivos; no puede establecer causalidad, representatividad nacional ni predicciones.");
    }
    dependencies.onStage?.("provider-plan");
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
      dependencies.onStage?.(call.name === "get_statistics" ? "statistics"
        : call.name === "compare_departments" ? "compare" : "semantic");
      evidence.push(await executeTool(call, request, dependencies.services, `ev-${index + 1}`));
    }
    const blocks = await buildBlocks(evidence, request.question, dependencies.provider, signal);
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
  onStage?: (stage: "provider-plan" | "statistics" | "compare" | "semantic" | "metadata") => void,
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
  const data = await createChatOrchestrator({ provider, services: adapters, onStage })(request, callerSignal);
  const evidenceFilters = data.evidence[0]?.filters;
  const sameEvidenceFilters = evidenceFilters
    && data.evidence.every((item) => JSON.stringify(item.filters) === JSON.stringify(evidenceFilters));
  onStage?.("metadata");
  return {
    data,
    meta: await adapters.getMetadata(requestId, sameEvidenceFilters ? evidenceFilters : request.filters ?? {}),
  };
}
