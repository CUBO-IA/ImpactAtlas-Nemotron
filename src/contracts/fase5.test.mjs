import assert from "node:assert/strict";
import test from "node:test";
import { reportRequestSchema } from "./reports.ts";

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

if (process.env.TEST_BASE_URL) {
  test("POST /api/reports/pdf entrega PDF binario mediante HTTP", async () => {
    const response = await fetch(new URL("/api/reports/pdf", process.env.TEST_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        indicators: ["sample_count", "income_mean"],
        sections: ["summary"],
      }),
    });

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /application\/pdf/);
    assert.match(response.headers.get("content-disposition") ?? "", /attachment/);
    assert.ok(response.headers.get("x-request-id"));
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 5000);
  });

  test("POST /api/reports/pdf devuelve JSON ante una solicitud inválida", async () => {
    const response = await fetch(new URL("/api/reports/pdf", process.env.TEST_BASE_URL), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ indicators: [], sections: [] }),
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error.code, "VALIDATION_ERROR");
    assert.ok(body.requestId);
  });
}
