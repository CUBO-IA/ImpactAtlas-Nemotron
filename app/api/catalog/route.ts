import { catalogResponseSchema } from "@/src/contracts/catalog";
import { toCatalogResponse, CatalogUnavailableError } from "@/src/data/catalog";
import { getCatalog } from "@/src/server/data-service";
import { RequestError, errorResponse } from "@/src/server/request";


export async function GET(request: Request) {
  const requestId = crypto.randomUUID();
  try {
    if (new URL(request.url).search) throw new RequestError(400, "VALIDATION_ERROR", "No se admiten parámetros de consulta.");
    const catalog = await getCatalog();
    const body = catalogResponseSchema.parse({
      data: toCatalogResponse(catalog),
      meta: {
        requestId,
        datasetId: catalog.dataset.id,
        datasetVersion: catalog.dataset.version,
        generatedAt: new Date().toISOString(),
        appliedFilters: {},
        sampleSize: null,
        warnings: [],
      },
    });
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RequestError) return errorResponse(error, requestId);
    const unavailable = error instanceof CatalogUnavailableError
      ? new RequestError(503, "DEPENDENCY_UNAVAILABLE", "El catálogo auditado no está disponible.")
      : new RequestError(503, "DEPENDENCY_UNAVAILABLE", "El catálogo no está disponible.");
    return errorResponse(unavailable, requestId);
  }
}
