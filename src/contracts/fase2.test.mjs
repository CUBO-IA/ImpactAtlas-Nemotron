import assert from "node:assert/strict";
import test from "node:test";
import { catalogResponseSchema } from "./catalog.ts";
import { statisticsRequestSchema, statisticsResponseSchema } from "./statistics.ts";

test("contrato de catálogo valida estructura completa", async () => {
  const { GET: getCatalog } = await import("../../app/api/catalog/route.ts");
  const res = await getCatalog();
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = catalogResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.equal(json.data.departments.length, 14);
  assert.equal(json.data.education.length, 7);
  assert.equal(json.data.occupations.length, 15);
  assert.equal(json.data.goals.length, 8);
});

test("estadísticas departamentales calcula métricas reales sobre la base de datos", async () => {
  const { POST: postStatistics } = await import("../../app/api/statistics/route.ts");
  const req = new Request("http://localhost:3000/api/statistics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      groupBy: "department",
      metrics: ["sample_count", "income_mean", "income_median", "financial_exclusion_pct"],
    }),
  });
  const res = await postStatistics(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = statisticsResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.equal(json.data.rows.length, 14);
  assert.equal(json.meta.sampleSize, 50000);

  // San Salvador check
  const sanSalvador = json.data.rows.find((r) => r.key === "san-salvador");
  assert.ok(sanSalvador);
  assert.ok(sanSalvador.sampleSize > 1000);
  assert.equal(sanSalvador.metrics.financial_exclusion_pct.unit, "percent");
});

test("estadísticas categóricas de educación y filtros de ingreso", async () => {
  const { POST: postStatistics } = await import("../../app/api/statistics/route.ts");
  const req = new Request("http://localhost:3000/api/statistics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { income: { min: 200, max: 600 } },
      groupBy: "education",
      metrics: ["category_count", "category_pct"],
    }),
  });
  const res = await postStatistics(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  const parsed = statisticsResponseSchema.safeParse(json);
  assert.equal(parsed.success, true);
  assert.equal(json.data.rows.length, 7);
  assert.ok(json.meta.sampleSize > 0);
  assert.ok(json.meta.sampleSize < 50000);
});

test("supresión de privacidad ante filtros extremos con cohorte vacía o insuficiente", async () => {
  const { POST: postStatistics } = await import("../../app/api/statistics/route.ts");
  const req = new Request("http://localhost:3000/api/statistics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { income: { min: 9999, max: 10000 } },
      groupBy: "department",
      metrics: ["sample_count", "income_mean"],
    }),
  });
  const res = await postStatistics(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.meta.sampleSize, 0);
  assert.equal(json.data.rows[0].metrics.sample_count.reason, "empty");
});

test.after(() => {
  process.exit(0);
});

