import assert from "node:assert/strict";
import test from "node:test";
import {
  renderReportPdf,
  generateReportPdf,
  publishedDistributionMax,
  ReportCancelledError,
  ReportConcurrencyError,
  ReportLimitError,
  ReportServiceUnavailableError,
  ReportTimeoutError,
} from "./reports.ts";
import { spawnSync } from "node:child_process";
import { reportErrorResponse } from "./report-http.ts";
import { InvalidCatalogFilterError } from "../data/catalog.ts";
import { createReportNarrative } from "./report-narrative.ts";
import { formatChartValue } from "../charts/chart-spec.ts";

const request = {
  indicators: ["sample_count", "income_mean"],
  sections: ["summary", "education", "ai_analysis"],
};

const metric = (value, unit = "records", suppressed = false) => ({
  value,
  unit,
  validN: 10,
  missingN: 0,
  suppressed,
  reason: suppressed ? "insufficient_sample" : null,
});

const snapshot = {
  snapshotId: "synthetic-test-snapshot",
  generatedAt: "2026-06-01T12:00:00.000Z",
  datasetId: "synthetic-fixture",
  datasetVersion: "test-v1",
  appliedFilters: {},
  sampleSize: 10,
  indicators: {
    sample_count: metric(10),
    income_mean: metric(125.5, "usd_estimated"),
    income_median: metric(null, "usd_estimated"),
    financial_exclusion_pct: metric(null, "percent", true),
  },
  sections: {
    education: [
      { label: "Educación básica", count: 8, percent: 80, suppressed: false },
      { label: "Categoría <script>", count: null, percent: null, suppressed: true },
      { label: "</td><img>", count: 5, percent: 20, suppressed: false },
    ],
  },
  warnings: ["Datos sintéticos de prueba."],
};

test("shared ChartSpec value formatter preserves decimal unit labels", () => {
  assert.equal(formatChartValue(12.34, "usd_estimated"), "$12.34");
  assert.equal(formatChartValue(12.34, "percent"), "12.3%");
  assert.equal(formatChartValue(12.34, "percentage_points"), "+12.3 pp");
});

test("LFM3 can only select deterministic facts present in the snapshot", async () => {
  let prompt;
  const narrative = await createReportNarrative(request, snapshot, new AbortController().signal, async (input) => {
    prompt = input.prompt;
    return { text: `\`\`\`json\n${JSON.stringify({ selections: ["metric:income_mean", "invented:claim"] })}\n\`\`\`` };
  });
  const allowed = JSON.parse(prompt);
  assert.ok(allowed.some(({ id }) => id === "metric:income_mean"));
  assert.equal(narrative.paragraphs.length, 1);
  assert.match(narrative.paragraphs[0], /Ingreso promedio estimado/);
  assert.doesNotMatch(narrative.paragraphs[0], /invented|claim/i);
  assert.equal(narrative.warning, undefined);
});

test("LFM3 failure abstains with a warning instead of failing statistical reporting", async () => {
  const narrative = await createReportNarrative(request, snapshot, new AbortController().signal, async () => {
    throw new Error("model unavailable");
  });
  assert.deepEqual(narrative.paragraphs, []);
  assert.match(narrative.warning, /reporte estadístico/);
});

test("renders a bounded PDF from a synthetic, already-aggregated snapshot", async () => {
  const pdf = await renderReportPdf(request, snapshot);
  assert.ok(pdf.byteLength > 1000);
  assert.ok(pdf.byteLength <= 10 * 1024 * 1024);
  assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
  assert.equal(new TextDecoder().decode(pdf.subarray(-6)), "%%EOF\n");
  const extracted = spawnSync("pdftotext", ["-", "-"], { input: Buffer.from(pdf), encoding: "utf8" });
  if (extracted.error?.code !== "ENOENT") {
    assert.equal(extracted.status, 0, extracted.stderr);
    assert.match(extracted.stdout, /Análisis IA no disponible; se conserva el reporte estadístico/);
    assert.match(extracted.stdout, /Educación básica/);
    assert.match(extracted.stdout, /Registros/);
  }
});

test("suppressed counts never affect the published bar scale", () => {
  const visible = { label: "Visible", count: 10, percent: 50, suppressed: false };
  const hiddenCountA = { label: "Hidden", count: 100, percent: null, suppressed: true };
  const hiddenCountB = { ...hiddenCountA, count: 1000000 };
  assert.equal(publishedDistributionMax([visible, hiddenCountA]), 10);
  assert.equal(publishedDistributionMax([visible, hiddenCountB]), 10);
});

test("rejects category counts over 20 rather than omitting rows", async () => {
  const tooManyCategories = Array.from({ length: 21 }, (_, index) => ({
    label: `Categoría ${index}`,
    count: 5,
    percent: 5,
    suppressed: false,
  }));
  await assert.rejects(
    renderReportPdf(
      { ...request, sections: ["education"] },
      { ...snapshot, sections: { education: tooManyCategories } },
    ),
    ReportLimitError,
  );
});

test("keeps all 20 valid category rows visible in the rendered PDF", async (t) => {
  const categories = Array.from({ length: 20 }, (_, index) => ({
    label: `Fila categoría ${String(index + 1).padStart(2, "0")}`,
    count: 20 - index,
    percent: 5,
    suppressed: false,
  }));
  const pdf = await renderReportPdf(
    { ...request, sections: ["education"] },
    { ...snapshot, sections: { education: categories } },
  );
  const extracted = spawnSync("pdftotext", ["-", "-"], {
    input: Buffer.from(pdf),
    encoding: "utf8",
  });
  if (extracted.error?.code === "ENOENT") {
    t.skip("pdftotext unavailable; PDF generation succeeded but category visibility could not be verified.");
    return;
  }
  assert.equal(extracted.status, 0, extracted.stderr);
  for (const { label } of categories) {
    assert.ok(extracted.stdout.includes(label), `PDF text omitted ${label}`);
  }
});

test("preserves long-table continuation, Spanish text, suppression, and filters in one snapshot PDF", async (t) => {
  const filters = { departmentIds: ["san-salvador"] };
  const categories = Array.from({ length: 20 }, (_, index) => ({
    label: index === 0 ? "Educación básica" : `Fila ${String(index + 1).padStart(2, "0")}`,
    count: index === 1 ? null : index + 1,
    percent: index === 1 ? null : 5,
    suppressed: index === 1,
  }));
  const pdf = await renderReportPdf(
    { ...request, filters, sections: ["education"] },
    { ...snapshot, appliedFilters: filters, sections: { education: categories } },
  );
  const extracted = spawnSync("pdftotext", ["-", "-"], {
    input: Buffer.from(pdf),
    encoding: "utf8",
  });
  if (extracted.error?.code === "ENOENT") {
    t.skip("pdftotext unavailable; PDF generation succeeded but text extraction could not be verified.");
    return;
  }
  assert.equal(extracted.status, 0, extracted.stderr);
  assert.match(extracted.stdout, /Educación básica/);
  assert.match(extracted.stdout, /Departamentos: san salvador/);
  assert.match(extracted.stdout, /Suprimido/);
  assert.match(extracted.stdout, /Fila 20/);
  assert.match(extracted.stdout, /Educación — continuación/);
});

test("rejects excessive warnings rather than silently dropping them", async () => {
  await assert.rejects(
    renderReportPdf(request, { ...snapshot, warnings: Array.from({ length: 11 }, () => "Advertencia") }),
    ReportLimitError,
  );
});

test("rejects missing requested facts rather than rendering an incomplete report", async () => {
  await assert.rejects(
    renderReportPdf({ ...request, sections: ["summary", "occupation"] }, snapshot),
    /no contiene la sección solicitada/,
  );
});

test("rejects a snapshot whose filters differ from the request", async () => {
  await assert.rejects(
    renderReportPdf({ ...request, filters: { departmentIds: ["san-salvador"] } }, snapshot),
    /filtros aplicados no coinciden/,
  );
});

test("fails closed for suppressed metrics that still expose a value", async () => {
  const invalidSnapshot = {
    ...snapshot,
    indicators: { ...snapshot.indicators, sample_count: metric(2, "records", true) },
  };
  await assert.rejects(renderReportPdf(request, invalidSnapshot), /expuesto? un valor|expone un valor/);
});

test("returns unavailable when no real snapshot provider is wired", async () => {
  await assert.rejects(generateReportPdf(request, undefined), ReportServiceUnavailableError);
  await assert.rejects(generateReportPdf(request, { getSnapshot: async () => null }), ReportServiceUnavailableError);
});

test("maps report failures to observable HTTP contract responses", async () => {
  const cases = [
    [new InvalidCatalogFilterError(), 400, "VALIDATION_ERROR"],
    [new ReportConcurrencyError(), 429, "BUSY"],
    [new ReportLimitError("límite"), 422, "REPORT_LIMIT_EXCEEDED"],
    [new ReportTimeoutError(), 504, "TIME_BUDGET_EXCEEDED"],
    [new ReportServiceUnavailableError(), 503, "DEPENDENCY_UNAVAILABLE"],
    [new Error("private internal detail"), 500, "INTERNAL_ERROR"],
  ];
  for (const [error, status, code] of cases) {
    const response = reportErrorResponse(error, "req-test-123");
    assert.equal(response.status, status);
    const body = await response.json();
    assert.equal(body.error.code, code);
    assert.equal(body.requestId, "req-test-123");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("retry-after"), status === 429 ? "1" : null);
  }
});

test("applies the shared request budget while obtaining the snapshot", async () => {
  let releaseSnapshot;
  let providerFinished = false;
  const provider = {
    getSnapshot: () => new Promise((resolve) => {
      releaseSnapshot = (value) => {
        providerFinished = true;
        resolve(value);
      };
    }),
  };
  await assert.rejects(
    generateReportPdf(request, provider, AbortSignal.timeout(10)),
    ReportTimeoutError,
  );
  assert.equal(providerFinished, false, "the provider exposes no cancellation signal");
  releaseSnapshot(snapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerFinished, true);
});

test("cancels a render before starting browser work", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    renderReportPdf(request, snapshot, controller.signal),
    ReportCancelledError,
  );
});

test("cancels in-flight Chromium work and releases the single-render slot", async () => {
  const controller = new AbortController();
  const pending = renderReportPdf(request, snapshot, controller.signal);
  await new Promise((resolve) => setTimeout(resolve, 100));
  controller.abort();
  await assert.rejects(pending, ReportCancelledError);
  const pdf = await renderReportPdf(request, snapshot);
  assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
});

test("renders the synthetic snapshot in bundled Chromium and extracts its PDF text", async (t) => {
  let pdf;
  try {
    pdf = await generateReportPdf(
      { ...request, sections: ["summary", "education"] },
      { getSnapshot: async () => snapshot },
    );
  } catch (error) {
    if (/executable|chromium|browser/i.test(String(error))) {
      t.skip(`Chromium unavailable in this environment: ${String(error)}`);
      return;
    }
    throw error;
  }
  assert.equal(new TextDecoder().decode(pdf.subarray(0, 5)), "%PDF-");
  assert.ok(pdf.byteLength <= 10 * 1024 * 1024);
  const extracted = spawnSync("pdftotext", ["-", "-"], {
    input: Buffer.from(pdf),
    encoding: "utf8",
  });
  if (extracted.error?.code === "ENOENT") {
    t.skip("pdftotext unavailable; Chromium PDF generation succeeded but text extraction could not be verified.");
    return;
  }
  assert.equal(extracted.status, 0, extracted.stderr);
  assert.match(extracted.stdout, /Fuente: synthetic-fixture/);
  assert.match(extracted.stdout, /Filtros aplicados/);
  assert.match(extracted.stdout, /No necesariamente representativos|no necesariamente representativos/i);
  assert.match(extracted.stdout, /Educación básica/);
  const info = spawnSync("pdfinfo", ["-"], { input: Buffer.from(pdf), encoding: "utf8" });
  if (info.error?.code !== "ENOENT") {
    assert.equal(info.status, 0, info.stderr);
    assert.match(info.stdout, /Pages:\s+2\b/);
  }
});

test("returns observable 429 BUSY before starting another snapshot read", async () => {
  const controller = new AbortController();
  let releaseSnapshot;
  let providerCalls = 0;
  let providerFinished = false;
  const provider = {
    getSnapshot: () => {
      providerCalls += 1;
      return new Promise((resolve) => {
        releaseSnapshot = (value) => {
          providerFinished = true;
          resolve(value);
        };
      });
    },
  };
  const first = generateReportPdf(request, provider, controller.signal);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerCalls, 1);

  let busyResponse;
  await assert.rejects(generateReportPdf(request, provider), (error) => {
    assert.ok(error instanceof ReportConcurrencyError);
    busyResponse = reportErrorResponse(error, "req-busy-456");
    return true;
  });
  assert.equal(busyResponse.status, 429);
  assert.equal(busyResponse.headers.get("retry-after"), "1");
  assert.deepEqual(await busyResponse.json(), {
    error: { code: "BUSY", message: "Ya se está generando otro reporte; inténtalo de nuevo." },
    requestId: "req-busy-456",
  });
  assert.equal(providerCalls, 1);

  controller.abort();
  await assert.rejects(first, ReportCancelledError);
  assert.equal(providerFinished, false, "the provider has no cancellation signal");
  releaseSnapshot(snapshot);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(providerFinished, true);
});
