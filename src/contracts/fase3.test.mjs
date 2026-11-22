import assert from "node:assert/strict";
import test from "node:test";
import { compareRequestSchema, compareResponseSchema } from "./compare.ts";

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

test("POST /api/compare calcula diferencias exactas, unidades de puntos porcentuales e invierte según referencia", async () => {
  const { POST: postCompare } = await import("../../app/api/compare/route.ts");

  // Consulta 1: Referencia Santa Ana
  const req1 = new Request("http://localhost:3000/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "santa-ana",
      metrics: ["sample_count", "income_mean", "financial_exclusion_pct"],
      breakdowns: [],
    }),
  });

  const res1 = await postCompare(req1);
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
  const expectedMeanDiff = Math.round((sanSalvador1.metrics.income_mean.value - santaAna1.metrics.income_mean.value) * 100) / 100;
  assert.equal(ssMeanDiff.value, expectedMeanDiff);
  assert.equal(ssMeanDiff.unit, "usd_estimated");

  // Unidad de exclusión financiera es puntos porcentuales
  const ssExclusionDiff = sanSalvador1.differences.find((d) => d.metricId === "financial_exclusion_pct");
  const expectedExclusionDiff = Math.round((sanSalvador1.metrics.financial_exclusion_pct.value - santaAna1.metrics.financial_exclusion_pct.value) * 100) / 100;
  assert.equal(ssExclusionDiff.value, expectedExclusionDiff);
  assert.equal(ssExclusionDiff.unit, "percentage_points");

  // Consulta 2: Invertir referencia a San Salvador
  const req2 = new Request("http://localhost:3000/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentIds: ["santa-ana", "san-salvador"],
      referenceDepartmentId: "san-salvador",
      metrics: ["income_mean", "financial_exclusion_pct"],
      breakdowns: [],
    }),
  });

  const res2 = await postCompare(req2);
  const json2 = await res2.json();
  const santaAna2 = json2.data.departments.find((d) => d.id === "santa-ana");
  const saMeanDiffInverted = santaAna2.differences.find((d) => d.metricId === "income_mean");
  assert.equal(saMeanDiffInverted.value, -expectedMeanDiff);
});

test("POST /api/compare genera distribuciones categóricas alineadas", async () => {
  const { POST: postCompare } = await import("../../app/api/compare/route.ts");

  const req = new Request("http://localhost:3000/api/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      departmentIds: ["santa-ana", "san-salvador", "san-miguel"],
      referenceDepartmentId: "san-salvador",
      metrics: ["income_mean"],
      breakdowns: ["education", "occupation"],
    }),
  });

  const res = await postCompare(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.departments.length, 3);

  for (const dept of json.data.departments) {
    assert.equal(dept.breakdowns.education.length, 7);
    assert.equal(dept.breakdowns.occupation.length, 15);
    // Verificamos que la primera categoría sea siempre 'sin-escolaridad' (orden del catálogo)
    assert.equal(dept.breakdowns.education[0].key, "sin-escolaridad");
  }
});

test("POST /api/compare maneja supresión de privacidad y diferencias nulas", async () => {
  const { POST: postCompare } = await import("../../app/api/compare/route.ts");

  const req = new Request("http://localhost:3000/api/compare", {
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

  const res = await postCompare(req);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.meta.sampleSize, 0);

  for (const dept of json.data.departments) {
    for (const diff of dept.differences) {
      assert.equal(diff.value, null);
    }
  }
});

test.after(() => {
  process.exit(0);
});
