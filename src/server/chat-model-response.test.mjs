import assert from "node:assert/strict";
import test from "node:test";
import { createChatOrchestrator } from "./chat.ts";

test("las preguntas conversacionales llegan al modelo sin consultar estadísticas", async () => {
  const question = "Explica qué haces como en la Edad Media";
  const chat = createChatOrchestrator({
    provider: {
      async plan(input) {
        assert.equal(input.question, question);
        return { status: "answered", text: "Bienvenido, noble viajero.", calls: [] };
      },
    },
    services: { async getStatistics() { throw new Error("Consulta inesperada"); } },
  });
  const result = await chat({ question });
  assert.equal(result.blocks[0].text, "Bienvenido, noble viajero.");
  assert.deepEqual(result.toolsUsed, []);
});

test("la respuesta basada en datos procede del modelo y recibe la pregunta y evidencia", async () => {
  const question = "Explica el ingreso de Santa Ana en estilo medieval";
  const chat = createChatOrchestrator({
    provider: {
      async plan() {
        return { status: "execute", calls: [{ name: "get_statistics", input: { groupBy: "department", metrics: ["income_mean"] } }] };
      },
      async answer({ request, evidence }) {
        assert.equal(request.question, question);
        assert.equal(evidence[0].facts[0].value, 250);
        return "Noble viajero, el ingreso es 250 USD.";
      },
    },
    services: {
      async getStatistics() {
        return { data: { groupBy: "department", rows: [{ key: "santa-ana", label: "Santa Ana", metrics: { income_mean: { value: 250, unit: "usd_estimated", suppressed: false } } }] }, meta: { sampleSize: 12 } };
      },
    },
  });
  const result = await chat({ question });
  assert.equal(result.blocks[0].text, "Noble viajero, el ingreso es 250 USD.");
  assert.deepEqual(result.blocks[0].evidenceIds, ["ev-1"]);
});

test("consulta técnicos por departamento sin ignorar un filtro de ocupación incompatible", async () => {
  const chat = createChatOrchestrator({
    provider: {
      async plan() {
        return { status: "execute", calls: [{ name: "get_statistics", input: { groupBy: "department", metrics: ["sample_count"], occupationId: "tecnico" } }] };
      },
      async answer({ evidence }) {
        assert.deepEqual(evidence[0].filters.occupationIds, ["tecnico"]);
        return `En la muestra, Santa Ana tiene ${evidence[0].facts[0].value} técnicos; no se identifica su especialidad.`;
      },
    },
    services: {
      async getStatistics(request) {
        assert.deepEqual(request.filters.occupationIds, ["tecnico"]);
        return { data: { groupBy: "department", rows: [{ key: "santa-ana", label: "Santa Ana", metrics: { sample_count: { value: 12, unit: "records", suppressed: false } } }] }, meta: { sampleSize: 12 } };
      },
    },
  });
  const question = "¿Dónde dar una capacitación para técnicos electricistas?";
  const result = await chat({ question });
  assert.match(result.blocks[0].text, /12 técnicos/);
  const conflicting = await chat({ question, filters: { occupationIds: ["agricultora"] } });
  assert.equal(conflicting.status, "needs_clarification");
  assert.deepEqual(conflicting.toolsUsed, []);
});

test("cruza educación, meta e ingresos respetando los filtros activos", async () => {
  const chat = createChatOrchestrator({
    provider: {
      async plan() {
        return { status: "execute", calls: [{ name: "get_statistics", input: {
          groupBy: "department", metrics: ["sample_count"], educationId: "tecnico",
          goalId: "capacitacion-tecnica", minIncome: 300, maxIncome: 700,
        } }] };
      },
      async answer({ evidence }) {
        assert.deepEqual(evidence[0].filters, {
          educationIds: ["tecnico"], goalIds: ["capacitacion-tecnica"], income: { min: 400, max: 700 },
        });
        return "Hay 12 registros en Santa Ana.";
      },
    },
    services: {
      async getStatistics(request) {
        assert.deepEqual(request.filters.income, { min: 400, max: 700 });
        return { data: { groupBy: "department", rows: [{ key: "santa-ana", label: "Santa Ana", metrics: { sample_count: { value: 12, unit: "records", suppressed: false } } }] }, meta: { sampleSize: 12 } };
      },
    },
  });
  const question = "¿Dónde hay técnicos interesados en capacitación con ingresos entre 300 y 700?";
  const result = await chat({ question, filters: { income: { min: 400, max: 900 } } });
  assert.equal(result.status, "answered");
  const conflicting = await chat({ question, filters: { income: { min: 800 } } });
  assert.equal(conflicting.status, "needs_clarification");
});

test("compara departamentos para el perfil solicitado", async () => {
  const chat = createChatOrchestrator({
    provider: {
      async plan() {
        return { status: "execute", calls: [{ name: "compare_departments", input: {
          departmentIds: ["santa-ana", "san-salvador"], referenceDepartmentId: "santa-ana",
          metrics: ["sample_count"], breakdowns: [], occupationId: "tecnico", goalId: "capacitacion-tecnica",
        } }] };
      },
      async answer({ evidence }) {
        assert.deepEqual(evidence[0].filters.goalIds, ["capacitacion-tecnica"]);
        return "Comparación de técnicos interesados en capacitación.";
      },
    },
    services: {
      async compareDepartments(request) {
        assert.deepEqual(request.filters, { occupationIds: ["tecnico"], goalIds: ["capacitacion-tecnica"] });
        return { data: { referenceDepartmentId: "santa-ana", departments: [{
          id: "santa-ana", label: "Santa Ana", metrics: { sample_count: { value: 12, unit: "records", suppressed: false } }, differences: [],
        }] } };
      },
    },
  });
  const result = await chat({ question: "Compara técnicos en Santa Ana y San Salvador" });
  assert.equal(result.status, "answered");
});
