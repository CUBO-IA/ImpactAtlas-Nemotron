import assert from "node:assert/strict";
import test from "node:test";
import { catalogResponseSchema } from "./catalog.ts";
import { statisticsResponseSchema } from "./statistics.ts";

const baseUrl = process.env.TEST_BASE_URL;
const dbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "1" && Boolean(baseUrl);

test("contrato de catálogo valida estructura completa", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/catalog", baseUrl));
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = catalogResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.ok(json.data.departments.length > 0);
  assert.ok(json.data.education.length > 0);
  assert.ok(json.data.occupations.length > 0);
  assert.ok(json.data.goals.length > 0);
});

test("estadísticas departamentales cumplen el contrato sobre la base local", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/statistics", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupBy: "department",
      metrics: ["sample_count", "income_mean", "income_median", "financial_exclusion_pct"],
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = statisticsResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.ok(json.data.rows.length > 0);
  assert.ok(json.meta.sampleSize === null || json.meta.sampleSize >= 0);

  // San Salvador check
  const sanSalvador = json.data.rows.find((r) => r.key === "san-salvador");
  assert.ok(sanSalvador);
  assert.ok(sanSalvador.sampleSize === null || sanSalvador.sampleSize >= 0);
  assert.equal(sanSalvador.metrics.financial_exclusion_pct.unit, "percent");
});

test("estadísticas categóricas de educación y filtros de ingreso", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/statistics", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { income: { min: 200, max: 600 } },
      groupBy: "education",
      metrics: ["category_count", "category_pct"],
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = statisticsResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.ok(json.data.rows.length > 0);
  assert.ok(json.meta.sampleSize === null || json.meta.sampleSize >= 0);
});

test("supresión de privacidad ante filtros extremos con cohorte vacía o insuficiente", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/statistics", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { income: { min: 9999, max: 10000 } },
      groupBy: "department",
      metrics: ["sample_count", "income_mean"],
    }),
  });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.meta.sampleSize, 0);
  assert.equal(json.data.rows[0].metrics.sample_count.reason, "empty");
});
