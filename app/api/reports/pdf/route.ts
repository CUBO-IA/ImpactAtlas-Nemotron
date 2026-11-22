import { reportRequestSchema } from "@/src/contracts/reports";
import { errorResponse, RequestError, readJsonRequest } from "@/src/server/request";
import { reportErrorResponse } from "@/src/server/report-http";
import { createReportSnapshotProvider } from "@/src/server/report-snapshot";
import { generateReportPdf } from "@/src/server/reports";


const snapshotProvider = createReportSnapshotProvider();

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let body: unknown;
  try {
    body = await readJsonRequest(request);
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(error, requestId);
    return errorResponse(new RequestError(400, "VALIDATION_ERROR", "Solicitud no válida."), requestId);
  }

  const parsed = reportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(new RequestError(400, "VALIDATION_ERROR", "La solicitud de reporte no es válida."), requestId);
  }

  try {
    // One budget covers snapshot lookup and rendering; the DB provider has its own timeout and no abort signal.
    const pdf = await generateReportPdf(parsed.data, snapshotProvider, request.signal);
    const body = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="reporte.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": requestId,
      },
    });
  } catch (error) {
    return reportErrorResponse(error, requestId);
  }
}
