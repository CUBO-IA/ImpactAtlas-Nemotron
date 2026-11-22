import assert from "node:assert/strict";
import test from "node:test";
import { env } from "@huggingface/transformers";
import {
  createLocalChatProvider,
  LocalModelUnavailableError,
} from "./provider.ts";

const validPlan = {
  status: "execute",
  calls: [{
    name: "get_statistics",
    input: { groupBy: "department", metrics: ["income_mean"] },
  }],
};

test("envía una solicitud acotada al modelo local y valida el plan generado", async () => {
  let request;
  const model = {};
  const provider = createLocalChatProvider({
    model,
    timeoutMs: 1234,
    generate: async (options) => {
      request = options;
      return {
        text: "",
        toolCalls: [{ toolName: "get_statistics", input: validPlan.calls[0].input }],
      };
    },
  });

  const plan = await provider.plan({
    question: "¿Cuál es el ingreso promedio?",
    history: [{ role: "user", text: "historial que no se envía" }],
    filters: { departmentIds: ["santa-ana"] },
  });

  assert.match(request.prompt, /¿Cuál es el ingreso promedio\?/);
  assert.equal(request.model, model);
  assert.equal(request.temperature, 0.1);
  assert.equal(request.maxOutputTokens, 256);
  assert.equal(request.maxRetries, 0);
  assert.equal(request.abortSignal instanceof AbortSignal, true);
  assert.doesNotMatch(request.system, /historial que no se envía|santa-ana/);
  assert.deepEqual(plan, validPlan);
  assert.equal(env.allowRemoteModels, false);
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
