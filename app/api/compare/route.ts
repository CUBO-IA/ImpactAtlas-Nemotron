import { compareRequestSchema, compareResponseSchema } from "@/src/contracts/compare";
import { getCatalog } from "@/src/server/data-service";
import { getStatistics } from "@/src/server/data-service";
import { CatalogUnavailableError, InvalidCatalogFilterError } from "@/src/data/catalog";
import { buildComparison, type DepartmentStatistics } from "@/src/server/comparison";
import { errorResponse, readJsonRequest, RequestError } from "@/src/server/request";
import type { StatisticsRequest } from "@/src/contracts/statistics";
import { createStatisticsBudget, StatisticsTimeBudgetError, throwIfStatisticsBudgetExceeded } from "@/src/server/statistics-budget";


export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const budget = createStatisticsBudget(request.signal);
  try {
    const input = compareRequestSchema.safeParse(await readJsonRequest(request, budget.signal));
    throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
    if (!input.success) throw new RequestError(400, "VALIDATION_ERROR", "La solicitud de comparación no es válida.");
    const catalog = await getCatalog(budget);
    const departments: DepartmentStatistics[] = [];
    for (const id of input.data.departmentIds) {
      throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
      const statsRequest: StatisticsRequest = {
        filters: { ...input.data.filters, departmentIds: [id] },
        groupBy: "department",
        metrics: input.data.metrics.length ? input.data.metrics : ["sample_count"],
      };
      const result = await getStatistics(statsRequest, catalog, budget);
      const row = result.rows[0];
      const breakdowns: DepartmentStatistics["breakdowns"] = {};
      for (const dimension of input.data.breakdowns) {
        throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
        const metricRequest: StatisticsRequest = {
          filters: { ...input.data.filters, departmentIds: [id] },
          groupBy: dimension,
          metrics: ["category_count", "category_pct"],
        };
        const categories = await getStatistics(metricRequest, catalog, budget);
        breakdowns[dimension] = categories.rows;
      }
      throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
      if (!row) throw new CatalogUnavailableError();
      departments.push({
        id,
        label: row.label,
        sampleSize: row.sampleSize,
        metrics: input.data.metrics.length ? row.metrics : {},
        breakdowns,
      });
    }
    throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
    const data = buildComparison(input.data, departments);
    const body = compareResponseSchema.parse({
      data,
      meta: {
        requestId,
        datasetId: catalog.dataset.id,
        datasetVersion: catalog.dataset.version,
        generatedAt: new Date().toISOString(),
        appliedFilters: {
          ...input.data.filters,
          departmentIds: [...input.data.departmentIds].sort(),
        },
        sampleSize: departments.some((department) => department.sampleSize === null)
          ? null
          : departments.reduce((sum, department) => sum + (department.sampleSize ?? 0), 0),
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
