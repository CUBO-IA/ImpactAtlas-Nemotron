import assert from "node:assert/strict";
import test from "node:test";
import { chatRequestSchema, chatResponseSchema } from "./chat.ts";

const baseUrl = process.env.TEST_BASE_URL;
const dbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "1" && Boolean(baseUrl);

test("contrato de chat valida límites, roles de historial y campos de pregunta", () => {
  // Pregunta vacía se rechaza
  assert.equal(chatRequestSchema.safeParse({ question: "   " }).success, false);

  // Rol de sistema no permitido en historial
  assert.equal(
    chatRequestSchema.safeParse({
      question: "¿Cuáles son los ingresos?",
      history: [{ role: "system", text: "instrucción" }],
    }).success,
    false
  );

  // Historial con más de 10 mensajes se rechaza
  assert.equal(
    chatRequestSchema.safeParse({
      question: "¿Cuáles son los ingresos?",
      history: Array(11).fill({ role: "user", text: "hola" }),
    }).success,
    false
  );

  // Pregunta válida
  assert.equal(
    chatRequestSchema.safeParse({
      question: "¿Cómo se comparan Santa Ana y San Salvador?",
      history: [{ role: "user", text: "hola" }, { role: "assistant", text: "saludos" }],
    }).success,
    true
  );
});

test("POST /api/chat fundamenta comparación con bloques de respuesta", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "¿Cómo se comparan los ingresos entre Santa Ana y San Salvador?",
      filters: { income: { min: 200 } },
      history: [],
    }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = chatResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);

  assert.equal(json.data.status, "answered");
  assert.ok(json.data.toolsUsed.includes("compare_departments"));
  assert.ok(json.data.evidence.length > 0);
  assert.equal(json.data.evidence[0].exhaustive, true);

  // La comparación se responde en prosa con hechos publicables y evidenceIds verificables.
  const textBlock = json.data.blocks.find((b) => b.type === "text");
  assert.ok(textBlock);
  assert.ok(textBlock.text.length > 0);
  assert.ok(textBlock.evidenceIds.length > 0);
  assert.ok(textBlock.evidenceIds.every((id) => json.data.evidence.some((item) => item.id === id)));

  const chartBlock = json.data.blocks.find((b) => b.type === "chart");
  if (chartBlock) {
    assert.equal(chartBlock.chart.series[0].values.length, chartBlock.chart.categories.length);
  }
});

test("POST /api/chat semántico responde según el gate de disponibilidad", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "¿Cuáles son las metas principales sobre tener negocio propio o crédito?",
      filters: {},
      history: [],
    }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = chatResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.ok(["answered", "insufficient_evidence"].includes(json.data.status));
  for (const evidence of json.data.evidence.filter((item) => item.kind === "semantic_examples")) {
    assert.equal(evidence.exhaustive, false);
  }
});

test("POST /api/chat detecta preguntas ambiguas y filtros sin evidencia suficiente", { skip: !dbIntegration }, async () => {
  // Caso 1: Saludo vago -> needs_clarification
  const res1 = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "hola",
      history: [],
    }),
  });
  const json1 = await res1.json();
  assert.equal(json1.data.status, "needs_clarification");

  // Caso 2: Filtro extremo vacío -> insufficient_evidence
  const res2 = await fetch(new URL("/api/chat", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "¿Cuánto ganan en San Salvador?",
      filters: { income: { min: 99999, max: 100000 } },
      history: [],
    }),
  });
  const json2 = await res2.json();
  assert.equal(json2.data.status, "insufficient_evidence");
});
