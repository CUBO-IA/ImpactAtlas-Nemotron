import assert from "node:assert/strict";
import test from "node:test";
import { env } from "@huggingface/transformers";
import {
  createLocalChatProvider,
  InvalidLocalChatPlanError,
  LocalModelUnavailableError,
} from "./provider.ts";

const validPlan = {
  status: "execute",
  calls: [{
    name: "get_statistics",
    input: { groupBy: "department", metrics: ["income_mean"] },
  }],
};

function permittedOperations(system) {
  return JSON.parse(system.match(/^Operaciones permitidas: (.+)$/m)[1]);
}

test("envía historial acotado y filtros en mensajes, y valida el plan generado", async () => {
  let request;
  const model = {};
  const provider = createLocalChatProvider({
    model,
    timeoutMs: 1234,
    generate: async (options) => {
      request = options;
      return {
        text: JSON.stringify({ calls: validPlan.calls }),
      };
    },
  });

  const history = Array.from({ length: 8 }, (_, index) => ({
    role: index % 2 ? "assistant" : "user",
    text: `mensaje-${index}`,
  }));
  const plan = await provider.plan({
    question: "¿Cuál es el ingreso promedio?",
    history,
    filters: { departmentIds: ["santa-ana"] },
  });

  const sent = request.messages.map(({ content }) => content).join("\n");
  assert.doesNotMatch(sent, /mensaje-[01]\b/);
  for (const index of [2, 3, 4, 5, 6, 7]) {
    assert.match(sent, new RegExp(`mensaje-${index}\\b`));
  }
  assert.match(sent, /santa-ana/);
  assert.match(sent, /¿Cuál es el ingreso promedio\?/);
  assert.equal(Object.hasOwn(request, "tools"), false);
  assert.equal(request.model, model);
  assert.equal(request.temperature, 0);
  assert.equal(request.maxOutputTokens, 384);
  assert.equal(request.maxRetries, 0);
  assert.equal(request.abortSignal instanceof AbortSignal, true);
  assert.deepEqual(plan, validPlan);
  assert.equal(env.allowRemoteModels, false);
});

test("planifica el salario promedio de La Libertad desde JSON envuelto o array cercado sin añadir ocupación", async () => {
  const json = JSON.stringify({ calls: validPlan.calls });
  for (const text of [json, `\`\`\`json\n${JSON.stringify(validPlan.calls)}\n\`\`\``]) {
    let attempts = 0;
    const provider = createLocalChatProvider({
      model: {},
      generate: async () => {
        attempts++;
        return { text };
      },
    });

    assert.deepEqual(await provider.plan({
      question: "¿Cuál es el salario promedio de La Libertad?",
      filters: { departmentIds: ["la-libertad"] },
    }), validPlan);
    assert.equal(attempts, 1);
  }
});

test("rechaza tools y argumentos fuera del esquema Zod", async () => {
  const provider = createLocalChatProvider({
    model: {},
    generate: async () => ({
      text: JSON.stringify({
        status: "execute",
        calls: [{ name: "execute_sql", input: { sql: "select 1" } }],
      }),
    }),
  });

  await assert.rejects(provider.plan({ question: "consulta", history: [], filters: {} }));
});

test("valida el formato local de tool call generado por LFM3", async () => {
  const provider = createLocalChatProvider({
    model: {},
    generate: async () => ({
      text: "<tool_call>\n<function=get_statistics>\n<parameter=groupBy>\ndepartment\n</parameter>\n<parameter=metrics>\n[\"income_mean\"]\n</parameter>\n</function>\n</tool_call>",
      toolCalls: [],
    }),
  });

  assert.deepEqual(await provider.plan({ question: "promedio", history: [], filters: {} }), {
    status: "execute",
    calls: [{ name: "get_statistics", input: { groupBy: "department", metrics: ["income_mean"] } }],
  });
});

test("reintenta cuando el modelo describe una herramienta en lugar de ejecutarla", async () => {
  let attempts = 0;
  const provider = createLocalChatProvider({
    model: {},
    generate: async () => ++attempts === 1
      ? { text: "Usaré get_statistics con occupationId tecnico. Voy a hacer la llamada:", toolCalls: [] }
      : { text: JSON.stringify({ calls: validPlan.calls }) },
  });

  assert.deepEqual(await provider.plan({
    question: "¿Cuál es el salario promedio de La Libertad?",
    filters: { departmentIds: ["la-libertad"] },
  }), validPlan);
  assert.equal(attempts, 2);
});

test("corrige automáticamente argumentos de herramienta inválidos", async () => {
  for (const invalid of [
    { departmentIds: ["la-libertad"] },
    { departmentId: "la-libertad" },
    { occupationId: "todos" },
  ]) {
    let attempts = 0;
    const provider = createLocalChatProvider({
      model: {},
      generate: async (options) => {
        if (++attempts === 1) {
          return { text: JSON.stringify({ calls: [{
            name: "get_statistics",
            input: { ...validPlan.calls[0].input, ...invalid },
          }] }) };
        }
        assert.match(options.messages.at(-1).content, new RegExp(`Errores de validación:.*${Object.keys(invalid)[0]}`));
        return { text: JSON.stringify({ calls: validPlan.calls }) };
      },
    });

    assert.deepEqual(await provider.plan({
      question: "¿Cuál es el salario promedio de La Libertad?",
      filters: { departmentIds: ["la-libertad"] },
    }), validPlan);
    assert.equal(attempts, 2);
  }
});

test("reintenta si el plan excede una llamada a herramienta", async () => {
  const call = { toolName: "get_statistics", input: validPlan.calls[0].input };
  for (const output of [
    { text: "", toolCalls: [call, call] },
    { text: JSON.stringify([validPlan.calls[0], validPlan.calls[0]]) },
  ]) {
    let attempts = 0;
    const provider = createLocalChatProvider({
      model: {},
      generate: async () => ++attempts === 1
        ? output
        : { text: JSON.stringify({ calls: validPlan.calls }) },
    });

    const plan = await provider.plan({ question: "Consulta estadísticas" });
    assert.equal(plan.status, "execute");
    assert.equal(plan.calls.length, 1);
    assert.equal(attempts, 2);
  }
});

test("ofrece estadísticas y comparación sin depender de palabras clave", async () => {
  const provider = createLocalChatProvider({
    model: {},
    generate: async (options) => {
      const operations = permittedOperations(options.system);
      assert.deepEqual(operations.map(({ name }) => name), ["get_statistics", "compare_departments"]);
      const [statistics, comparison] = operations.map(({ inputSchema }) => inputSchema);
      assert.deepEqual(statistics.required, ["groupBy", "metrics"]);
      assert.ok(statistics.properties.groupBy.enum.includes("department"));
      assert.ok(statistics.properties.metrics.items.enum.includes("income_mean"));
      assert.equal(statistics.additionalProperties, false);
      for (const key of ["departmentId", "departmentIds", "filters"]) {
        assert.equal(Object.hasOwn(statistics.properties, key), false);
      }
      assert.deepEqual(comparison.required, ["departmentIds", "referenceDepartmentId", "metrics", "breakdowns"]);
      assert.equal(comparison.properties.departmentIds.type, "array");
      return { text: JSON.stringify({ calls: [
        { name: "compare_departments", input: {
          departmentIds: ["santa-ana", "san-salvador"], referenceDepartmentId: "santa-ana",
          metrics: ["income_mean"], breakdowns: [],
        } },
      ] }) };
    },
  });
  const plan = await provider.plan({ question: "¿Dónde hay mayores ingresos, en Santa Ana o San Salvador, y qué educación tienen?" });
  assert.deepEqual(plan.calls.map(({ name }) => name), ["compare_departments"]);
});

test("ofrece solo las dos herramientas agregadas incluso para similitud explícita", async () => {
  let availableTools;
  const provider = createLocalChatProvider({
    model: {},
    generate: async (options) => {
      availableTools = permittedOperations(options.system).map(({ name }) => name);
      return { text: "No hay búsqueda semántica disponible.", toolCalls: [] };
    },
  });
  await provider.plan({ question: "¿Qué categorías similares a técnico aparecen en la muestra?" });
  assert.deepEqual(availableTools, ["get_statistics", "compare_departments"]);
  await provider.plan({ question: "Explora los ingresos promedio de Santa Ana" });
  assert.deepEqual(availableTools, ["get_statistics", "compare_departments"]);
});

test("rechaza herramientas no expuestas tanto del SDK como de JSON y XML", async () => {
  const call = { name: "search_semantic_evidence", input: { text: "temas similares", topK: 5 } };
  for (const output of [
    { text: "", toolCalls: [{ toolName: call.name, input: call.input }] },
    { text: JSON.stringify({ calls: [call] }), toolCalls: [] },
    { text: JSON.stringify([call]) },
    { text: '<tool_call><function=search_semantic_evidence><parameter=text>temas similares</parameter><parameter=topK>5</parameter></function></tool_call>', toolCalls: [] },
  ]) {
    const provider = createLocalChatProvider({ model: {}, generate: async () => output });
    await assert.rejects(provider.plan({ question: "Busca temas similares" }), InvalidLocalChatPlanError);
  }
});

test("descarta desgloses fuera del catálogo sin perder una comparación válida", async () => {
  const provider = createLocalChatProvider({
    model: {},
    generate: async () => ({
      text: "",
      toolCalls: [{
        toolName: "compare_departments",
        input: {
          departmentIds: ["santa-ana", "san-salvador"],
          referenceDepartmentId: "san-salvador",
          metrics: ["income_mean"],
          breakdowns: ["education", "invalid_dimension"],
        },
      }],
    }),
  });

  assert.deepEqual(await provider.plan({ question: "compara ingresos" }), {
    status: "execute",
    calls: [{
      name: "compare_departments",
      input: {
        departmentIds: ["santa-ana", "san-salvador"],
        referenceDepartmentId: "san-salvador",
        metrics: ["income_mean"],
        breakdowns: ["education"],
      },
    }],
  });
});

test("clasifica argumentos de herramienta inválidos como plan local inválido", async () => {
  const provider = createLocalChatProvider({
    model: {},
    generate: async () => ({
      text: "",
      toolCalls: [{
        toolName: "compare_departments",
        input: {
          departmentIds: ["santa-ana", "san-salvador"],
          referenceDepartmentId: "san-salvador",
          metrics: ["not-a-metric"],
          breakdowns: [],
        },
      }],
    }),
  });

  await assert.rejects(provider.plan({ question: "compara ingresos" }), InvalidLocalChatPlanError);
});

test("reporta claramente que el modelo local no pudo inicializarse", async () => {
  const provider = createLocalChatProvider({
    model: {},
    generate: async () => { throw new Error("local files missing"); },
  });

  await assert.rejects(provider.plan({ question: "consulta", history: [], filters: {} }), LocalModelUnavailableError);
});

test("propaga la cancelación al AI SDK sin convertirla en error de modelo", async () => {
  const controller = new AbortController();
  let sdkSignal;
  const provider = createLocalChatProvider({
    model: {},
    generate: async (options) => {
      sdkSignal = options.abortSignal;
      return new Promise((resolve, reject) => {
        options.abortSignal.addEventListener("abort", () => reject(options.abortSignal.reason), { once: true });
      });
    },
  });
  const pending = provider.plan({ question: "consulta", history: [], filters: {} }, controller.signal);
  await Promise.resolve();
  controller.abort();

  await assert.rejects(pending, (error) => error.name === "AbortError");
  assert.equal(sdkSignal.aborted, true);
});

test("ignora texto libre del modelo y solicita aclaración estática", async () => {
  const provider = createLocalChatProvider({
    model: {},
    generate: async () => ({ text: "contenido privado no estructurado" }),
  });

  const plan = await provider.plan({ question: "consulta", history: [], filters: {} });
  assert.equal(plan.status, "needs_clarification");
  assert.equal(plan.question, "Se necesita precisar la consulta.");
});
