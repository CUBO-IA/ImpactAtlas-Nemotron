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

function dependencies({ plan, metric = 250, semanticHits = [] } = {}) {
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
          data: { groupBy: "department", rows: [{
            key: "santa-ana", label: "Santa Ana", sampleSize: 12,
            metrics: { income_mean: {
              value: metric, unit: "usd_estimated", validN: 12, missingN: 0,
              suppressed: false, reason: null,
            } },
          }] },
          meta: { ...meta, sampleSize: 12 },
        };
      },
      async compareDepartments(input) {
        calls.push(["compare", input]);
        return { data: { referenceDepartmentId: input.referenceDepartmentId, departments: [] }, meta };
      },
      async searchSemanticEvidence(input) {
        calls.push(["semantic", input]);
        return semanticHits;
      },
    },
  };
}

test("renderiza tablas deterministas con hechos permitidos y aplica filtros del cliente", async () => {
  const deps = dependencies();
  const result = await createChatOrchestrator(deps)(request);
  assert.equal(result.status, "answered");
  assert.deepEqual(deps.calls.find(([name]) => name === "statistics")[1].filters, request.filters);
  assert.equal(result.evidence[0].facts[0].value, 250);
  assert.deepEqual(result.blocks[0].rows, [["Santa Ana: Ingreso promedio estimado (USD)", 250, "usd_estimated"]]);
  assert.deepEqual(result.blocks[0].evidenceIds, [result.evidence[0].id]);
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
