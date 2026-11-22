import assert from "node:assert/strict";
import test from "node:test";
import { publishableCategories, searchSemantic } from "./semantic.ts";

const catalog = {
  audited: true,
  dataset: { id: "d", version: "v", sourceLabel: "audit", collectionPeriod: null, incomePeriod: null },
  departments: [{ id: "san-salvador", label: "San Salvador", geoFeatureId: "ss", sqlValues: ["San Salvador"] }],
  education: { basic: { label: "Básica", values: ["Básica"] }, __missing__: { label: "Sin dato", values: [] } },
  occupations: { formal: { label: "Formal", values: ["Formal"] }, __missing__: { label: "Sin dato", values: [] } },
  goals: {
    savings: { label: "Ahorro", values: ["Ahorro", "Guardar dinero"] },
    business: { label: "Emprendimiento", values: ["Emprender"] },
  },
} as const;

test("only audited goal labels with k=5 candidates are returned; no metrics escape", () => {
  const result = publishableCategories([
    { category_id: "savings", n: 5 },
    { category_id: "business", n: 4 },
    { category_id: "unknown", n: 20 },
  ], catalog as never, 5);
  assert.deepEqual(result, {
    status: "ok",
    interpretation: "exploratory_not_prevalence",
    categories: ["Ahorro"],
  });
  assert.equal(JSON.stringify(result).match(/5|4|20|score|id/gi), null);
});

test("suppresses all categories below k and abstains without a publishable bucket", () => {
  assert.deepEqual(publishableCategories([
    { category_id: "savings", n: 1 },
    { category_id: "business", n: 4 },
  ], catalog as never, 5), {
    status: "abstained",
    reason: "no_publishable_aggregate",
  });
});

test("compatibility gate abstains before attempting Prisma or model access", async () => {
  const enabled = process.env.SEMANTIC_SEARCH_ENABLED;
  const audit = process.env.SEMANTIC_SEARCH_AUDIT;
  delete process.env.SEMANTIC_SEARCH_ENABLED;
  delete process.env.SEMANTIC_SEARCH_AUDIT;
  try {
    const result = await searchSemantic(Array(768).fill(0), catalog as never);
    assert.deepEqual(result, {
      status: "abstained",
      reason: "no_publishable_aggregate",
    });
  } finally {
    if (enabled === undefined) delete process.env.SEMANTIC_SEARCH_ENABLED;
    else process.env.SEMANTIC_SEARCH_ENABLED = enabled;
    if (audit === undefined) delete process.env.SEMANTIC_SEARCH_AUDIT;
    else process.env.SEMANTIC_SEARCH_AUDIT = audit;
  }
});
