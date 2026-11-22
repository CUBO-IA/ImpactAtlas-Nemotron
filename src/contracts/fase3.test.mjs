import assert from "node:assert/strict";
import test from "node:test";
import { compareRequestSchema, compareResponseSchema } from "./compare.ts";

const baseUrl = process.env.TEST_BASE_URL;
const dbIntegration = process.env.RUN_DB_INTEGRATION_TESTS === "1" && Boolean(baseUrl);

test("contrato de comparación valida restricciones de departamentos y filtros territoriales", () => {
  // 1 departamento es inválido (mínimo 2)
  assert.equal(
    compareRequestSchema.safeParse({
      departmentIds: ["santa-ana"],
      referenceDepartmentId: "santa-ana",
      metrics: ["income_mean"],
      breakdowns: [],
    }).success,
    false
  );

  // Referencia fuera de la selección es inválida
  assert.equal(
    compareRequestSchema.safeParse({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "sonsonate",
      metrics: ["income_mean"],
      breakdowns: [],
    }).success,
    false
  );

  // Duplicados en departmentIds
  assert.equal(
    compareRequestSchema.safeParse({
      departmentIds: ["santa-ana", "santa-ana"],
      referenceDepartmentId: "santa-ana",
      metrics: ["income_mean"],
      breakdowns: [],
    }).success,
    false
  );

  // Filtro territorial duplicado dentro de filters se rechaza estrictamente
  assert.equal(
    compareRequestSchema.safeParse({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "santa-ana",
      filters: { departmentIds: ["santa-ana"] },
      metrics: ["income_mean"],
      breakdowns: [],
    }).success,
    false
  );

  // Sin métricas ni distribuciones se rechaza
  assert.equal(
    compareRequestSchema.safeParse({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "santa-ana",
      metrics: [],
      breakdowns: [],
    }).success,
    false
  );
});

test("POST /api/compare conserva referencia y unidades de diferencia", { skip: !dbIntegration }, async () => {
  // Consulta 1: Referencia Santa Ana
  const res1 = await fetch(new URL("/api/compare", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "santa-ana",
      metrics: ["sample_count", "income_mean", "financial_exclusion_pct"],
      breakdowns: [],
    }),
  });

  assert.equal(res1.status, 200);
  const json1 = await res1.json();
  const parsed1 = compareResponseSchema.safeParse(json1);
  assert.equal(parsed1.success, true);
  assert.equal(json1.data.departments.length, 2);

  const santaAna1 = json1.data.departments.find((d) => d.id === "santa-ana");
  const sanSalvador1 = json1.data.departments.find((d) => d.id === "san-salvador");
  assert.ok(santaAna1);
  assert.ok(sanSalvador1);

  // Referencia tiene diferencia 0
  const santaAnaMeanDiff = santaAna1.differences.find((d) => d.metricId === "income_mean");
  assert.equal(santaAnaMeanDiff.value, 0);

  // San Salvador diferencia = SS - SA
  const ssMeanDiff = sanSalvador1.differences.find((d) => d.metricId === "income_mean");
  const expectedMeanDiff = sanSalvador1.metrics.income_mean.value - santaAna1.metrics.income_mean.value;
  assert.equal(ssMeanDiff.value, expectedMeanDiff);
  assert.equal(ssMeanDiff.unit, "usd_estimated");

  // Unidad de exclusión financiera es puntos porcentuales
  const ssExclusionDiff = sanSalvador1.differences.find((d) => d.metricId === "financial_exclusion_pct");
  const expectedExclusionDiff = sanSalvador1.metrics.financial_exclusion_pct.value - santaAna1.metrics.financial_exclusion_pct.value;
  assert.equal(ssExclusionDiff.value, expectedExclusionDiff);
  assert.equal(ssExclusionDiff.unit, "percentage_points");

  // Consulta 2: Invertir referencia a San Salvador
  const res2 = await fetch(new URL("/api/compare", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "san-salvador",
      metrics: ["income_mean", "financial_exclusion_pct"],
      breakdowns: [],
    }),
  });

  const json2 = await res2.json();
  const santaAna2 = json2.data.departments.find((d) => d.id === "santa-ana");
  const saMeanDiffInverted = santaAna2.differences.find((d) => d.metricId === "income_mean");
  assert.equal(saMeanDiffInverted.value, -expectedMeanDiff);
});

test("POST /api/compare genera distribuciones categóricas alineadas", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/compare", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentIds: ["santa-ana", "san-salvador", "san-miguel"],
      referenceDepartmentId: "san-salvador",
      metrics: ["income_mean"],
      breakdowns: ["education", "occupation"],
    }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.departments.length, 3);

  for (const dept of json.data.departments) {
    assert.ok(dept.breakdowns.education.length > 0);
    assert.ok(dept.breakdowns.occupation.length > 0);
  }
});

test("POST /api/compare maneja supresión de privacidad y diferencias nulas", { skip: !dbIntegration }, async () => {
  const res = await fetch(new URL("/api/compare", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "santa-ana",
      filters: { income: { min: 9999, max: 10000 } },
      metrics: ["income_mean", "sample_count"],
      breakdowns: [],
    }),
  });

  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.meta.sampleSize, 0);

  for (const dept of json.data.departments) {
    for (const diff of dept.differences) {
      assert.equal(diff.value, diff.metricId === "sample_count" ? 0 : null);
    }
  }
});
