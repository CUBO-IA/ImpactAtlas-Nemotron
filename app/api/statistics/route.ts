import { statisticsRequestSchema, statisticsResponseSchema } from "@/src/contracts/statistics";
import { getCatalog, getStatistics } from "@/src/server/data-service";
import { createStatisticsBudget, StatisticsTimeBudgetError, throwIfStatisticsBudgetExceeded } from "@/src/server/statistics-budget";
import { CatalogUnavailableError, InvalidCatalogFilterError } from "@/src/data/catalog";
import { errorResponse, readJsonRequest, RequestError } from "@/src/server/request";


export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const budget = createStatisticsBudget(request.signal);
  try {
    const input = statisticsRequestSchema.safeParse(await readJsonRequest(request, budget.signal));
    throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
    if (!input.success) throw new RequestError(400, "VALIDATION_ERROR", "La solicitud de estadísticas no es válida.");
    const catalog = await getCatalog(budget);
    const result = await getStatistics(input.data, catalog, budget);
    throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
    const filters = input.data.filters ?? {};
    const body = statisticsResponseSchema.parse({
      data: { groupBy: input.data.groupBy, rows: result.rows },
      meta: {
        requestId,
        datasetId: catalog.dataset.id,
        datasetVersion: catalog.dataset.version,
        generatedAt: new Date().toISOString(),
        appliedFilters: Object.fromEntries(Object.entries(filters).map(([key, value]) =>
          [key, Array.isArray(value) ? [...value].sort() : value])),
        sampleSize: result.sampleSize,
        warnings: [
          { code: "NON_REPRESENTATIVE_SAMPLE", message: "Datos de muestra; no necesariamente representativos de El Salvador." },
          { code: "ESTIMATED_INCOME", message: `Ingresos estimados; período ${catalog.dataset.incomePeriod ?? "no documentado"}.` },
        ],
      },
    });
    throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof StatisticsTimeBudgetError) {
      return errorResponse(new RequestError(504, "TIME_BUDGET_EXCEEDED", "La solicitud excedió el presupuesto de 15 segundos."), requestId);
    }
    if (error instanceof RequestError) return errorResponse(error, requestId);
    if (error instanceof InvalidCatalogFilterError) {
      return errorResponse(new RequestError(400, "VALIDATION_ERROR", "Un filtro no existe en el catálogo auditado."), requestId);
    }
    const unavailable = error instanceof CatalogUnavailableError
      ? new RequestError(503, "DEPENDENCY_UNAVAILABLE", "No hay catálogo auditado disponible.")
      : new RequestError(503, "DEPENDENCY_UNAVAILABLE", "Los datos no están disponibles.");
    return errorResponse(unavailable, requestId);
  } finally {
    budget.dispose();
  }
}
