import assert from "node:assert/strict";
import test from "node:test";
import { buildCategoryRows, buildDepartmentAggregates, buildDepartmentRows } from "./statistics.ts";
import { suppressBinaryRate, suppressBreakdown, suppressMetric } from "./privacy.ts";
import { buildComparison } from "./comparison.ts";
import {
  categoryOptions,
  CatalogUnavailableError,
  loadAuditedCatalog,
  resolveCategoryFilter,
  resetCatalogCacheForTests,
  toCatalogResponse,
  validateAuditedFilters,
} from "../data/catalog.ts";
import { buildReportSnapshot, toReportCategory } from "./report-snapshot.ts";
import { InvalidCatalogFilterError } from "../data/catalog.ts";
import { reportErrorResponse } from "./report-http.ts";

test("privacy suppression hides small cohorts, binary numerators, and reconstructable category complements", () => {
  const metric = { value: 2, validN: 2, missingN: 0, suppressed: false, reason: null };
  assert.equal(suppressMetric(metric, 2).value, null);
  assert.equal(suppressBinaryRate(2, 20), true);
  const buckets = suppressBreakdown([{ count: 2 }, { count: 18 }], 20);
  assert.deepEqual(buckets.map(({ count }) => count), [null, null]);
});

test("statistics distinguish empty universes from suppressed small samples", () => {
  const empty = buildDepartmentRows(
    { groupBy: "department", metrics: ["income_mean"] },
    [],
    [{ id: "ahuachapan", label: "Ahuachapán" }],
  )[0];
  assert.equal(empty?.sampleSize, 0);
  assert.equal(empty?.metrics.income_mean?.value, null);
  assert.equal(empty?.metrics.income_mean?.reason, "empty");

  const small = buildCategoryRows([{ key: "a", label: "A", count: 3 }], 3, ["category_count"])[0];
  assert.equal(small?.sampleSize, null);
  assert.equal(small?.metrics.category_count?.validN, null);
  const complementary = buildCategoryRows(
    [{ key: "small", label: "Small", count: 2 }, { key: "large", label: "Large", count: 8 }],
    10,
    ["category_count", "category_pct"],
  );
  assert.deepEqual(complementary.map((row) => row.sampleSize), [null, null]);
  assert.ok(complementary.every((row) =>
    row.metrics.category_count?.suppressed && row.metrics.category_pct?.suppressed &&
    row.metrics.category_count.validN === null && row.metrics.category_pct.missingN === null));

  const sparseIncome = buildDepartmentRows(
    { groupBy: "department", metrics: ["income_mean"] },
    [{ key: "ahuachapan", label: "A", n: 20, incomeValidN: 3, incomeMean: 20, incomeMedian: 20, financeValidN: 20, financeExcludedN: 10 }],
    [{ id: "ahuachapan", label: "Ahuachapán" }],
  )[0];
  assert.equal(sparseIncome?.metrics.income_mean?.suppressed, true);
  assert.equal(sparseIncome?.metrics.income_mean?.validN, null);

  const financial = buildDepartmentRows(
    { groupBy: "department", metrics: ["financial_exclusion_pct"] },
    [{ key: "ahuachapan", label: "A", n: 12, incomeValidN: 12, incomeMean: 10, incomeMedian: 10, financeValidN: 12, financeExcludedN: 2 }],
    [{ id: "ahuachapan", label: "Ahuachapán" }],
  )[0]?.metrics.financial_exclusion_pct;
  assert.deepEqual(
    [financial?.value, financial?.validN, financial?.missingN, financial?.suppressed, financial?.reason],
    [null, null, null, true, "insufficient_sample"],
  );
});

test("department aggregates match stable IDs and missing-category filters cannot become open filters", () => {
  const rows = buildDepartmentAggregates(
    [{ key: "ahuachapan", label: "ahuachapan", n: 8, incomeValidN: 8, incomeMean: 2, incomeMedian: 2, financeValidN: 8, financeExcludedN: 4 }],
    [{ id: "ahuachapan", label: "Ahuachapán" }, { id: "cabanas", label: "Cabañas" }],
  );
  assert.equal(rows[0]?.n, 8);
  assert.equal(rows[0]?.incomeMean, 2);
  assert.equal(rows[1]?.n, 0);
  assert.deepEqual(
    resolveCategoryFilter({ high: { values: ["Bachillerato"] } }, ["__missing__"]),
    { active: true, includesMissing: true, values: [] },
  );
});

test("missing category is selectable only when audited and appears once in catalog and grouped output", () => {
  const catalog = {
    departments: [],
    education: {
      __missing__: { label: "Sin dato", values: [] },
      secondary: { label: "Secundaria", values: ["Secundaria"] },
    },
    occupations: {},
    goals: {},
    dataset: { id: "fixture", version: "fixture-v1", sourceLabel: "Fixture", collectionPeriod: null, incomePeriod: null },
  };
  validateAuditedFilters(catalog, { educationIds: ["__missing__"] });
  assert.deepEqual(resolveCategoryFilter(catalog.education, ["__missing__"]), {
    active: true,
    includesMissing: true,
    values: [],
  });
  assert.deepEqual(categoryOptions(catalog, "education").map(({ id }) => id), ["secondary"]);
  assert.equal(toCatalogResponse(catalog).education.filter(({ id }) => id === "__missing__").length, 1);
  assert.throws(
    () => validateAuditedFilters({ ...catalog, education: { secondary: catalog.education.secondary } }, { educationIds: ["__missing__"] }),
  );
});

test("report snapshots preserve suppression and omit complementary counts", () => {
  const request = {
    filters: {},
    indicators: ["sample_count", "income_mean", "income_median", "financial_exclusion_pct"],
    sections: ["summary", "education"],
  };
  const catalog = { dataset: { id: "fixture", version: "v1", incomePeriod: null } };
  const small = buildReportSnapshot({
    request,
    catalog,
    generatedAt: "2026-11-22T00:00:00.000Z",
    snapshotId: "fixture-snapshot",
    aggregate: {
      key: "__all__", label: "__all__", n: 3,
      incomeValidN: 3, incomeMean: 12, incomeMedian: 12,
      financeValidN: 3, financeExcludedN: 1,
    },
    sections: {},
  });
  assert.equal(small.sampleSize, null);
  assert.equal(small.indicators.sample_count.value, null);
  assert.equal(small.indicators.financial_exclusion_pct.suppressed, true);

  const suppressedCategory = toReportCategory({
    key: "small",
    label: "Muestra insuficiente",
    sampleSize: null,
    metrics: {
      category_count: { value: null, unit: "records", validN: null, missingN: null, suppressed: true, reason: "insufficient_sample" },
      category_pct: { value: null, unit: "percent", validN: null, missingN: null, suppressed: true, reason: "complementary_suppression" },
    },
  });
  assert.deepEqual(suppressedCategory, {
    label: "Muestra insuficiente", count: null, percent: null, suppressed: true,
  });
});

test("catalog loading fails closed without DATA_CATALOG_PATH, even for localhost", async () => {
  const previousCatalogPath = process.env["DATA_CATALOG_PATH"];
  const previousDatabaseUrl = process.env["DATABASE_URL"];
  delete process.env["DATA_CATALOG_PATH"];
  process.env["DATABASE_URL"] = "postgresql://localhost/nemotron";
  resetCatalogCacheForTests();
  try {
    await assert.rejects(loadAuditedCatalog(), CatalogUnavailableError);
  } finally {
    if (previousCatalogPath === undefined) delete process.env["DATA_CATALOG_PATH"];
    else process.env["DATA_CATALOG_PATH"] = previousCatalogPath;
    if (previousDatabaseUrl === undefined) delete process.env["DATABASE_URL"];
    else process.env["DATABASE_URL"] = previousDatabaseUrl;
    resetCatalogCacheForTests();
  }
});

test("report invalid catalog filters return HTTP 400 and empty snapshots retain zero/no-data metrics", () => {
  const response = reportErrorResponse(new InvalidCatalogFilterError(), "request-id");
  assert.equal(response.status, 400);

  const empty = buildReportSnapshot({
    request: {
      filters: {},
      indicators: ["sample_count", "income_mean"],
      sections: ["summary"],
    },
    catalog: { dataset: { id: "fixture", version: "v1", incomePeriod: null } },
    generatedAt: "2026-11-22T00:00:00.000Z",
    snapshotId: "empty-snapshot",
    aggregate: {
      key: "__all__", label: "__all__", n: 0,
      incomeValidN: 0, incomeMean: null, incomeMedian: null,
      financeValidN: 0, financeExcludedN: 0,
    },
    sections: {},
  });
  assert.equal(empty.sampleSize, 0);
  assert.equal(empty.indicators.sample_count.value, 0);
  assert.equal(empty.indicators.income_mean.value, null);
  assert.equal(empty.indicators.income_mean.reason, "empty");
});

test("comparison computes exact differences and leaves suppressed differences null", () => {
  const data = buildComparison(
    {
      departmentIds: ["ahuachapan", "cabanas"],
      referenceDepartmentId: "ahuachapan",
      metrics: ["income_mean"],
      breakdowns: [],
    },
    [
      { id: "ahuachapan", label: "A", sampleSize: 20, metrics: { income_mean: { value: 1.11, unit: "usd_estimated", validN: 20, missingN: 0, suppressed: false, reason: null } }, breakdowns: {} },
      { id: "cabanas", label: "B", sampleSize: 20, metrics: { income_mean: { value: 2.22, unit: "usd_estimated", validN: 20, missingN: 0, suppressed: false, reason: null } }, breakdowns: {} },
    ],
  );
  assert.equal(data.departments[1]?.differences[0]?.value, 1.11);
});
