import assert from "node:assert/strict";
import test from "node:test";
import {
  chatRequestSchema,
  chartSpecSchema,
  compareRequestSchema,
  filtersSchema,
  reportRequestSchema,
  statisticsRequestSchema,
} from "./api.ts";
import { chatRequestSchema as indexedChatRequestSchema } from "./index.ts";

test("el índice y la ruta anterior exportan los mismos contratos", () => {
  assert.equal(indexedChatRequestSchema, chatRequestSchema);
});

test("estadísticas valida filtros, duplicados y métricas por agrupación", () => {
  const request = {
    filters: { departmentIds: ["santa-ana"], income: { min: 0, max: 800 } },
    groupBy: "department",
    metrics: ["sample_count", "income_mean"],
  };
  assert.equal(statisticsRequestSchema.safeParse(request).success, true);
  assert.equal(filtersSchema.safeParse({ income: { min: 10, max: 2 } }).success, false);
  assert.equal(filtersSchema.safeParse({ income: {} }).success, false);
  assert.equal(filtersSchema.safeParse({ departmentIds: ["santa-ana", "santa-ana"] }).success, false);
  assert.equal(statisticsRequestSchema.safeParse({ ...request, metrics: ["category_pct"] }).success, false);
  assert.equal(statisticsRequestSchema.safeParse({ ...request, sql: "SELECT" }).success, false);
});

test("comparación exige referencia seleccionada, sin filtro territorial duplicado", () => {
  const request = {
    departmentIds: ["santa-ana", "san-salvador"],
    referenceDepartmentId: "santa-ana",
    metrics: ["income_mean"],
    breakdowns: [],
  };
  assert.equal(compareRequestSchema.safeParse(request).success, true);
  assert.equal(compareRequestSchema.safeParse({ ...request, referenceDepartmentId: "sonsonate" }).success, false);
  assert.equal(compareRequestSchema.safeParse({ ...request, filters: { departmentIds: ["santa-ana"] } }).success, false);
  assert.equal(compareRequestSchema.safeParse({ ...request, metrics: [] }).success, false);
});

test("chat, reportes y gráficos respetan los límites del contrato", () => {
  assert.equal(chatRequestSchema.safeParse({ question: "  ingresos  ", history: [] }).data.question, "ingresos");
  assert.equal(chatRequestSchema.safeParse({ question: " ", history: [] }).success, false);
  assert.equal(chatRequestSchema.safeParse({ question: "hola", history: [{ role: "system", text: "x" }] }).success, false);
  assert.equal(reportRequestSchema.safeParse({ indicators: ["sample_count"], sections: ["summary"] }).success, true);
  assert.equal(reportRequestSchema.safeParse({ indicators: ["sample_count"], sections: [] }).success, false);
  assert.equal(chartSpecSchema.safeParse({
    type: "bar", title: "Ingresos", categories: ["Santa Ana"],
    series: [{ name: "Ingreso", values: [], unit: "usd_estimated" }], evidenceIds: [],
  }).success, false);
});
