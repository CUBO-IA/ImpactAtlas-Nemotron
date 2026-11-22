import assert from "node:assert/strict";
import test from "node:test";
import { chatRequestSchema, chatResponseSchema } from "./chat.ts";

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

test("POST /api/chat ejecuta comparación departamental fundamentada con bloques de tabla y gráfico", async () => {
  const { POST: postChat } = await import("../../app/api/chat/route.ts");

  const req = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "¿Cómo se comparan los ingresos entre Santa Ana y San Salvador?",
      filters: { income: { min: 200 } },
      history: [],
    }),
  });

  const res = await postChat(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = chatResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);

  assert.equal(json.data.status, "answered");
  assert.ok(json.data.toolsUsed.includes("compare_departments"));
  assert.ok(json.data.evidence.length > 0);
  assert.equal(json.data.evidence[0].exhaustive, true);

  // Verifica que existan bloques de texto y tabla/gráfico
  const textBlock = json.data.blocks.find((b) => b.type === "text");
  assert.ok(textBlock);
  assert.ok(textBlock.evidenceIds.length > 0);

  const tableBlock = json.data.blocks.find((b) => b.type === "table");
  assert.ok(tableBlock);
  assert.ok(tableBlock.rows.length >= 2);

  const chartBlock = json.data.blocks.find((b) => b.type === "chart");
  if (chartBlock) {
    assert.equal(chartBlock.chart.series[0].values.length, chartBlock.chart.categories.length);
  }
});

test("POST /api/chat maneja consultas semánticas y cualitativas de metas", async () => {
  const { POST: postChat } = await import("../../app/api/chat/route.ts");

  const req = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "¿Cuáles son las metas principales sobre tener negocio propio o crédito?",
      filters: {},
      history: [],
    }),
  });

  const res = await postChat(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = chatResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.equal(json.data.status, "answered");

  // Semantic evidence check
  const semanticEvidence = json.data.evidence.find((e) => e.kind === "semantic_examples");
  assert.ok(semanticEvidence);
  assert.equal(semanticEvidence.exhaustive, false);
});

test("POST /api/chat detecta preguntas ambiguas y filtros sin evidencia suficiente", async () => {
  const { POST: postChat } = await import("../../app/api/chat/route.ts");

  // Caso 1: Saludo vago -> needs_clarification
  const req1 = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "hola",
      history: [],
    }),
  });
  const res1 = await postChat(req1);
  const json1 = await res1.json();
  assert.equal(json1.data.status, "needs_clarification");

  // Caso 2: Filtro extremo vacío -> insufficient_evidence
  const req2 = new Request("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "¿Cuánto ganan en San Salvador?",
      filters: { income: { min: 99999, max: 100000 } },
      history: [],
    }),
  });
  const res2 = await postChat(req2);
  const json2 = await res2.json();
  assert.equal(json2.data.status, "insufficient_evidence");
});

test.after(() => {
  process.exit(0);
});
