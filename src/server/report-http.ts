import { errorResponse, RequestError } from "./request.ts";
import { InvalidCatalogFilterError } from "../data/catalog.ts";
import {
  ReportCancelledError,
  ReportConcurrencyError,
  ReportLimitError,
  ReportServiceUnavailableError,
  ReportTimeoutError,
} from "./reports.ts";

export function reportErrorResponse(error: unknown, requestId: string): Response {
  let status: number;
  let code: string;
  let message: string;
  let retryAfter: string | undefined;

  if (error instanceof InvalidCatalogFilterError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Uno o más filtros no existen en el catálogo auditado.";
  } else if (error instanceof ReportConcurrencyError) {
    status = 429;
    code = "BUSY";
    message = error.message;
    retryAfter = "1";
  } else if (error instanceof ReportLimitError) {
    status = 422;
    code = "REPORT_LIMIT_EXCEEDED";
    message = error.message;
  } else if (error instanceof ReportTimeoutError) {
    status = 504;
    code = "TIME_BUDGET_EXCEEDED";
    message = error.message;
  } else if (error instanceof ReportServiceUnavailableError) {
    status = 503;
    code = "DEPENDENCY_UNAVAILABLE";
    message = error.message;
  } else if (error instanceof ReportCancelledError) {
    status = 499;
    code = "REQUEST_CANCELLED";
    message = error.message;
  } else {
    status = 500;
    code = "INTERNAL_ERROR";
    message = "No fue posible generar el reporte.";
  }

  const response = errorResponse(new RequestError(status, code, message), requestId);
  if (retryAfter) response.headers.set("Retry-After", retryAfter);
  return response;
}
