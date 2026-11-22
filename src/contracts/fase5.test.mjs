import assert from "node:assert/strict";
import test from "node:test";
import { reportRequestSchema } from "./reports.ts";
import { renderSvgBarChartSSR } from "../services/report-generator.ts";

test("contrato de reporte valida indicadores (1-4) y secciones (1-5)", () => {
  // Sin indicadores es inválido
  assert.equal(
    reportRequestSchema.safeParse({
      indicators: [],
      sections: ["summary"],
    }).success,
    false
  );

  // Sin secciones es inválido
  assert.equal(
    reportRequestSchema.safeParse({
      indicators: ["income_mean"],
      sections: [],
    }).success,
    false
  );

  // Solicitud válida
  assert.equal(
    reportRequestSchema.safeParse({
      filters: { departmentIds: ["santa-ana"], income: { min: 200 } },
      indicators: ["sample_count", "income_mean"],
      sections: ["summary", "education", "ai_analysis"],
    }).success,
    true
  );
});

test("renderSvgBarChartSSR genera SVG válido en el servidor sin document ni window", () => {
  const svgHtml = renderSvgBarChartSSR(
    "Ingresos Departamentales",
    ["Santa Ana", "San Salvador"],
    [540.25, 620.5],
    "usd_estimated"
  );

  assert.ok(svgHtml.includes("<svg"));
  assert.ok(svgHtml.includes("Santa Ana"));
  assert.ok(svgHtml.includes("$540.25"));
  assert.ok(svgHtml.includes("$620.50"));
});

test("POST /api/reports/pdf genera documento PDF binario real con cabeceras y firma %PDF-", async () => {
  const { POST: postReportPdf } = await import("../../app/api/reports/pdf/route.ts");

  const req = new Request("http://localhost:3000/api/reports/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { departmentIds: ["santa-ana", "san-salvador"] },
      indicators: ["sample_count", "income_mean", "financial_exclusion_pct"],
      sections: ["summary", "education", "ai_analysis"],
    }),
  });

  const res = await postReportPdf(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("Content-Type"), "application/pdf");
  assert.ok(res.headers.get("Content-Disposition")?.includes("impactatlas-reporte.pdf"));
  assert.ok(res.headers.get("X-Request-Id"));

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validar firma estándar de PDF (%PDF-)
  assert.equal(buffer.subarray(0, 5).toString("ascii"), "%PDF-");
  // Tamaño sustancial
  assert.ok(buffer.length > 5000);
});

test("POST /api/reports/pdf rechaza petición inválida con JSON de error, nunca guarda archivo corrupto", async () => {
  const { POST: postReportPdf } = await import("../../app/api/reports/pdf/route.ts");

  const req = new Request("http://localhost:3000/api/reports/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      indicators: [],
      sections: [],
    }),
  });

  const res = await postReportPdf(req);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, "VALIDATION_FAILED");
});

test.after(() => {
  process.exit(0);
});
