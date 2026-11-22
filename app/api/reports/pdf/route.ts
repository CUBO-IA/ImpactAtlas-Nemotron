import { reportRequestSchema } from "../../../../src/contracts/reports.ts";
import { errorResponseSchema } from "../../../../src/contracts/common.ts";
import { generateReportPdf } from "../../../../src/services/report-generator.ts";

export const maxDuration = 60;

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "INVALID_JSON",
          message: "El cuerpo de la solicitud no es un JSON válido.",
        },
        requestId,
      }),
      { status: 400 }
    );
  }

  const parsed = reportRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
      acc[issue.path.join(".")] = issue.message;
      return acc;
    }, {});

    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "VALIDATION_FAILED",
          message: "La solicitud no cumple con los contratos de validación de reportes.",
          fields: errorDetails,
        },
        requestId,
      }),
      { status: 400 }
    );
  }

  try {
    const pdfBuffer = await generateReportPdf(parsed.data, requestId);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="impactatlas-reporte.pdf"',
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "REPORT_GENERATION_FAILED",
          message: "No fue posible generar el documento PDF en el servidor.",
        },
        requestId,
      }),
      { status: 500 }
    );
  }
}
