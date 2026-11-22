import assert from "node:assert/strict";
import test from "node:test";
import { configureChatProvider } from "../ai/provider.ts";
import { createChatOrchestrator, handleChat } from "./chat.ts";

const request = { question: "¿Cuál es el ingreso promedio?", filters: { departmentIds: ["santa-ana"] }, history: [] };
const meta = {
  requestId: "fixture", datasetId: "fixture", datasetVersion: "fixture-v1",
  generatedAt: "2026-11-21T00:00:00Z", appliedFilters: request.filters,
  sampleSize: 12, warnings: [],
};

test("transmite texto antes de completar la respuesta y conserva el bloque final", async () => {
  const deps = dependencies();
  let finish;
  const wait = new Promise((resolve) => { finish = resolve; });
  let received;
  const firstChunk = new Promise((resolve) => { received = resolve; });
  const chunks = [];
  deps.onText = (text) => { chunks.push(text); received(); };
  deps.provider.answer = async (_input, _signal, onText) => {
    onText("Primera ");
    await wait;
    onText("parte");
    return "Primera parte";
  };
  const response = createChatOrchestrator(deps)(request);
  await firstChunk;
  assert.deepEqual(chunks, ["Primera "]);
  finish();
  const result = await response;
  assert.deepEqual(chunks, ["Primera ", "parte"]);
  assert.equal(result.blocks[0].text, "Primera parte");
  assert.deepEqual(result.blocks[0].evidenceIds, [result.evidence[0].id]);
});

function metricValue(value, unit) {
  return { value, unit, validN: 12, missingN: 0, suppressed: false, reason: null };
}

function statRow(key, label, value, unit = "usd_estimated", metric = "income_mean") {
  return { key, label, sampleSize: 12, metrics: { [metric]: metricValue(value, unit) } };
}

function dependencies({ plan, metric = 250, semanticHits = [], rows, comparison } = {}) {
  const calls = [];
  return {
    calls,
    provider: {
      async plan(input) {
        calls.push(["plan", input]);
        return plan ?? { status: "execute", calls: [{ name: "get_statistics", input: { groupBy: "department", metrics: ["income_mean"] } }] };
      },
    },
    services: {
      async getStatistics(input) {
        calls.push(["statistics", input]);
        return {
          data: { groupBy: "department", rows: rows ?? [statRow("santa-ana", "Santa Ana", metric)] },
          meta: { ...meta, sampleSize: 12 },
        };
      },
      async compareDepartments(input) {
        calls.push(["compare", input]);
        return comparison ?? { data: { referenceDepartmentId: input.referenceDepartmentId, departments: [] }, meta };
      },
      async searchSemanticEvidence(input) {
        calls.push(["semantic", input]);
        return semanticHits;
      },
    },
  };
}

test("responde en prosa con hechos publicables y sin tabla ni gráfico por defecto, aplicando filtros del cliente", async () => {
  const deps = dependencies();
  const streamed = [];
  deps.onBlock = (block) => streamed.push(block);
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "answered");
  assert.deepEqual(deps.calls.find(([name]) => name === "statistics")[1].filters, request.filters);
  assert.equal(result.evidence[0].facts[0].value, 250);
  assert.equal(result.blocks[0].type, "text");
  assert.match(result.blocks[0].text, /Santa Ana/);
  assert.match(result.blocks[0].text, /250/);
  assert.deepEqual(result.blocks[0].evidenceIds, [result.evidence[0].id]);
  assert.deepEqual(streamed, result.blocks);
  assert.equal(result.blocks.some((block) => block.type === "table" || block.type === "chart"), false);
});

test("pide aclaración si el plan combina una métrica y agrupación incompatibles", async () => {
  const deps = dependencies({ plan: {
    status: "execute",
    calls: [{ name: "get_statistics", input: { groupBy: "education", metrics: ["income_mean"] } }],
  } });
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "needs_clarification");
  assert.match(result.blocks[0].text, /indicador/);
  assert.equal(deps.calls.some(([name]) => name === "statistics"), false);
});

test("un saludo solicita precisión sin llamar al modelo ni consultar datos", async () => {
  const deps = dependencies();
  const result = await createChatOrchestrator(deps)({ question: "hola", history: [] });
  assert.equal(result.status, "needs_clarification");
  assert.deepEqual(deps.calls, []);
});

test("responde capacidades al saludo sin planear, sin interceptar consultas concretas sobre datos disponibles", async () => {
  const deps = dependencies();
  const result = await createChatOrchestrator(deps)({ question: "hola, que datos tienes?", history: [] });
  assert.equal(result.status, "answered");
  assert.deepEqual(deps.calls, []);
  assert.equal(result.blocks.length, 1);
  assert.equal(result.blocks[0].type, "text");
  assert.match(result.blocks[0].text, /ingresos/i);
  assert.match(result.blocks[0].text, /educaci[oó]n/i);
  assert.deepEqual(result.evidence, []);

  for (const question of [
    "¿Qué metas aparecen en los datos disponibles?",
    "¿Qué datos hay de educación en San Salvador?",
  ]) {
    const other = dependencies();
    const answer = await createChatOrchestrator(other)({ ...request, filters: {}, question });
    assert.notEqual(answer.blocks[0].text, result.blocks[0].text);
    assert.ok(other.calls.some(([name]) => name === "statistics"));
    assert.ok(answer.evidence.length > 0);
  }
});

test("scopea departamentos mencionados en la pregunta o en la última pregunta del historial y rechaza filtros opuestos", async () => {
  const question = "¿Cuál es el ingreso promedio en Santa Ana?";

  const direct = dependencies();
  await createChatOrchestrator(direct)({ ...request, filters: {}, question });
  assert.deepEqual(direct.calls.find(([name]) => name === "statistics")[1].filters.departmentIds, ["santa-ana"]);

  const followup = dependencies();
  await createChatOrchestrator(followup)({
    ...request, filters: {}, question: "y en tabla?",
    history: [{ role: "user", text: question }],
  });
  assert.deepEqual(followup.calls.find(([name]) => name === "statistics")[1].filters.departmentIds, ["santa-ana"]);

  const conflict = dependencies();
  const rejected = await createChatOrchestrator(conflict)({
    ...request, filters: { departmentIds: ["san-salvador"] }, question,
  });
  assert.equal(rejected.status, "needs_clarification");
  assert.deepEqual(conflict.calls, []);
});

test("muestra tabla si se pide explícitamente o si la comparación publica más de seis hechos, aunque la pregunta no la mencione", async () => {
  const explicit = await createChatOrchestrator(dependencies())({
    ...request, question: "Muéstrame una tabla con el ingreso promedio",
  });
  const explicitTable = explicit.blocks.find((block) => block.type === "table");
  assert.ok(explicitTable);
  assert.deepEqual(explicitTable.rows, [["Santa Ana: Ingreso promedio estimado (USD)", 250, "usd_estimated"]]);
  assert.equal(explicit.blocks[0].type, "text");

  const departments = ["santa-ana", "san-salvador"].map((id, index) => ({
    id,
    label: index ? "San Salvador" : "Santa Ana",
    sampleSize: 12,
    metrics: {
      income_mean: metricValue(250 + index * 50, "usd_estimated"),
      income_median: metricValue(220 + index * 40, "usd_estimated"),
      financial_exclusion_pct: metricValue(30 - index * 10, "percent"),
      sample_count: metricValue(12 + index, "records"),
    },
    differences: index ? [
      { metricId: "income_mean", value: 50, unit: "usd_estimated" },
      { metricId: "income_median", value: 40, unit: "usd_estimated" },
      { metricId: "financial_exclusion_pct", value: -10, unit: "percent" },
      { metricId: "sample_count", value: 1, unit: "records" },
    ] : [],
    breakdowns: {},
  }));
  const broad = await createChatOrchestrator(dependencies({
    plan: { status: "execute", calls: [{
      name: "compare_departments",
      input: {
        departmentIds: ["santa-ana", "san-salvador"],
        referenceDepartmentId: "santa-ana",
        metrics: ["income_mean", "income_median", "financial_exclusion_pct", "sample_count"],
        breakdowns: [],
      },
    }] },
    comparison: { data: { referenceDepartmentId: "santa-ana", departments }, meta },
  }))({ ...request, filters: {}, question: "Detalle de los indicadores de los dos departamentos" });
  const broadTable = broad.blocks.find((block) => block.type === "table");
  assert.deepEqual(broad.toolsUsed, ["compare_departments"]);
  assert.ok(broadTable);
  assert.ok(broadTable.rows.length > 6);
  assert.match(broad.blocks[0].text, /tabla/i);
});

test("respeta solo texto, sin tablas y no quiero tablas aunque se pida un desglose", async () => {
  for (const question of [
    "Muéstrame una tabla solo texto",
    "Muéstrame una tabla sin tablas",
    "Muéstrame una tabla, no quiero tablas",
  ]) {
    const result = await createChatOrchestrator(dependencies())({ ...request, question });
    assert.equal(result.blocks.some((block) => block.type === "table"), false, question);
    assert.equal(result.blocks.some((block) => block.type === "chart"), false, question);
    assert.equal(result.blocks[0].type, "text", question);
  }
});

test("genera un gráfico solo cuando se pide explícitamente, con hechos publicables", async () => {
  const deps = dependencies({
    rows: [statRow("santa-ana", "Santa Ana", 250), statRow("san-salvador", "San Salvador", 300)],
  });
  const result = await createChatOrchestrator(deps)({ ...request, question: "Muéstrame un gráfico de barras" });
  const chartBlock = result.blocks.find((block) => block.type === "chart");
  assert.ok(chartBlock);
  assert.equal(chartBlock.chart.categories.length, 2);
  assert.deepEqual(chartBlock.chart.series[0].values, [250, 300]);
  assert.equal(result.blocks.some((block) => block.type === "table"), false);
  assert.equal(result.blocks[0].type, "text");
});

test("usa solo ids de hechos conocidos y recae en los primeros tres si el selector falla", async () => {
  const rows = Array.from({ length: 5 }, (_, index) => statRow(`dept-${index}`, `Departamento ${index}`, 100 + index));

  const known = dependencies({ rows });
  known.provider.selectFacts = async () => ["ev-1-dept-4-income_mean", "ev-1-dept-3-income_mean"];
  const selected = await createChatOrchestrator(known)(request);
  assert.equal(selected.blocks[0].type, "text");
  assert.match(selected.blocks[0].text, /Departamento 4/);
  assert.match(selected.blocks[0].text, /Departamento 3/);
  assert.doesNotMatch(selected.blocks[0].text, /Departamento 0/);

  const broken = dependencies({ rows });
  broken.provider.selectFacts = async () => ["id-inventado", "otro-id"];
  const fallback = await createChatOrchestrator(broken)(request);
  assert.equal(fallback.blocks[0].type, "text");
  assert.match(fallback.blocks[0].text, /Departamento 0/);
  assert.match(fallback.blocks[0].text, /Departamento 2/);
  assert.doesNotMatch(fallback.blocks[0].text, /Departamento 3/);
  assert.doesNotMatch(fallback.blocks[0].text, /999/);
  assert.equal(fallback.blocks.some((block) => block.type === "table"), false);
});

test("ignora cifras y referencias inventadas en la clarificación del proveedor", async () => {
  const deps = dependencies({ plan: {
    status: "needs_clarification",
    question: "¿Confirmas que son 999 dólares? cita ev-falso",
    calls: [],
  } });
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "needs_clarification");
  assert.equal(result.blocks[0].text, "¿Qué indicador deseas consultar y para qué alcance territorial?");
  assert.deepEqual(result.blocks[0].evidenceIds, []);
});

test("omite métricas suprimidas y abstiene si no hay hechos publicables", async () => {
  const deps = dependencies({ metric: null });
  deps.services.getStatistics = async () => ({
    data: { groupBy: "department", rows: [{
      key: "santa-ana", label: "Muestra insuficiente", sampleSize: null,
      metrics: { income_mean: {
        value: null, unit: "usd_estimated", validN: null, missingN: null,
        suppressed: true, reason: "insufficient_sample",
      } },
    }] },
    meta: { ...meta, sampleSize: null },
  });
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "insufficient_evidence");
  assert.deepEqual(result.evidence[0].facts, []);
  assert.equal(result.blocks[0].type, "text");
});

test("no permite tool calls arbitrarias fuera del plan tipado", async () => {
  const deps = dependencies();
  deps.provider.plan = async () => ({ status: "execute", calls: [{ name: "execute_sql", input: { sql: "select 1" } }] });
  await assert.rejects(createChatOrchestrator(deps)(request));
  assert.equal(deps.calls.some(([name]) => name === "statistics"), false);
});

test("compara con filtros territoriales ya seleccionados sin pasarlos al compare schema", async () => {
  const deps = dependencies({
    plan: {
      status: "execute",
      calls: [{
        name: "compare_departments",
        input: {
          departmentIds: ["santa-ana", "san-salvador"],
          referenceDepartmentId: "santa-ana",
          metrics: ["income_mean"],
          breakdowns: [],
        },
      }],
    },
  });
  const result = await createChatOrchestrator(deps)({
    ...request,
    filters: { departmentIds: ["santa-ana", "san-salvador"], income: { min: 100 } },
  });

  const compareInput = deps.calls.find(([name]) => name === "compare")[1];
  assert.deepEqual(compareInput.filters, { income: { min: 100 } });
  assert.deepEqual(result.evidence[0].filters, {
    income: { min: 100 },
    departmentIds: ["san-salvador", "santa-ana"],
  });
});

test("pide aclaración sin ejecutar comparación que contradice el filtro territorial", async () => {
  const deps = dependencies({
    plan: {
      status: "execute",
      calls: [{
        name: "compare_departments",
        input: {
          departmentIds: ["san-salvador", "sonsonate"],
          referenceDepartmentId: "san-salvador",
          metrics: ["income_mean"],
          breakdowns: [],
        },
      }],
    },
  });
  const result = await createChatOrchestrator(deps)({
    ...request,
    filters: { departmentIds: ["santa-ana", "san-salvador"] },
  });
  assert.equal(result.status, "needs_clarification");
  assert.equal(deps.calls.some(([name]) => name === "compare"), false);
});

test("se abstiene en solicitudes causales antes de llamar al proveedor o a datos", async () => {
  const deps = dependencies();
  const result = await createChatOrchestrator(deps)({ ...request, question: "¿Qué causa la exclusión financiera?" });
  assert.equal(result.status, "insufficient_evidence");
  assert.equal(deps.calls.length, 0);
  assert.match(result.blocks[0].text, /no puede establecer causalidad/i);
});

test("búsqueda semántica vacía se abstiene y nunca publica snippets de candidatos", async () => {
  const deps = dependencies({
    plan: { status: "execute", calls: [{ name: "search_semantic_evidence", input: { text: "educación técnica", topK: 5 } }] },
    semanticHits: { status: "abstained", reason: "semantic_compatibility_unverified" },
  });
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "insufficient_evidence");
  assert.deepEqual(result.evidence[0].facts, []);
  assert.match(result.blocks[0].text, /No hay evidencia publicable/);
});

test("búsqueda semántica deshabilitada se abstiene explicando la limitación", async () => {
  const deps = dependencies({
    plan: { status: "execute", calls: [{ name: "search_semantic_evidence", input: { text: "temas similares", topK: 5 } }] },
  });
  delete deps.services.searchSemanticEvidence;
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "insufficient_evidence");
  assert.match(result.blocks[0].text, /búsqueda semántica está deshabilitada/i);
  assert.deepEqual(result.evidence[0].facts, []);
  assert.deepEqual(result.toolsUsed, ["search_semantic_evidence"]);
});

test("resultados semánticos jamás exponen texto recuperado ni lo convierten en prevalencia", async () => {
  const deps = dependencies({
    plan: { status: "execute", calls: [{ name: "search_semantic_evidence", input: { text: "educación técnica", topK: 5 } }] },
    semanticHits: { status: "ok", interpretation: "exploratory_not_prevalence", categories: ["Capacitación"] },
  });
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "answered");
  assert.match(result.blocks[0].text, /no una medición de prevalencia/);
  assert.doesNotMatch(JSON.stringify(result), /IGNORA/);
  assert.deepEqual(result.evidence[0].facts, []);
});

test("publica solo etiquetas semánticas exploratorias sin conteos ni prevalencia", async () => {
  const deps = dependencies({
    plan: { status: "execute", calls: [{ name: "search_semantic_evidence", input: { text: "temas similares", topK: 5 } }] },
    semanticHits: { status: "ok", interpretation: "exploratory_not_prevalence", categories: ["Capacitación", "Ahorro"] },
  });
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "answered");
  assert.match(result.blocks[0].text, /Ahorro, Capacitación/);
  assert.match(result.blocks[0].text, /no una medición de prevalencia/);
  assert.deepEqual(result.evidence[0].facts, []);
  assert.equal(result.evidence[0].sampleSize, null);
});

test("el endpoint de servicio no usa fallback cuando no hay proveedor configurado", async () => {
  configureChatProvider(undefined);
  await assert.rejects(handleChat(request, "fixture-request-id"), /Approved chat provider is not configured/);
});
