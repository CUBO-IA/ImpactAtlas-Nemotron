import { randomUUID } from "node:crypto";
import type { CompareRequest, CompareResponse } from "../contracts/compare.ts";
import type { StatisticsRequest, StatisticsResponse } from "../contracts/statistics.ts";
import { getCatalog, getStatistics } from "./data-service";
import { buildComparison, type DepartmentStatistics } from "./comparison";

const warnings = (incomePeriod: string | null) => [
  { code: "NON_REPRESENTATIVE_SAMPLE", message: "Datos de muestra; no necesariamente representativos de El Salvador." },
  { code: "ESTIMATED_INCOME", message: `Ingresos estimados; período ${incomePeriod ?? "no documentado"}.` },
];

function metadata(catalog: Awaited<ReturnType<typeof getCatalog>>, filters: StatisticsRequest["filters"], sampleSize: number | null) {
  return {
    requestId: randomUUID(),
    datasetId: catalog.dataset.id,
    datasetVersion: catalog.dataset.version,
    generatedAt: new Date().toISOString(),
    appliedFilters: filters ?? {},
    sampleSize,
    warnings: warnings(catalog.dataset.incomePeriod),
  };
}

export function createChatServices() {
  return {
    async getMetadata(requestId: string, filters: StatisticsRequest["filters"] = {}) {
      const catalog = await getCatalog();
      return {
        requestId,
        datasetId: catalog.dataset.id,
        datasetVersion: catalog.dataset.version,
        generatedAt: new Date().toISOString(),
        appliedFilters: Object.fromEntries(Object.entries(filters).map(([key, value]) =>
          [key, Array.isArray(value) ? [...value].sort() : value])),
        sampleSize: null,
        warnings: warnings(catalog.dataset.incomePeriod),
      };
    },

    async getStatistics(request: StatisticsRequest): Promise<StatisticsResponse> {
      const catalog = await getCatalog();
      const result = await getStatistics(request, catalog);
      return {
        data: { groupBy: request.groupBy, rows: result.rows },
        meta: metadata(catalog, request.filters, result.sampleSize),
      };
    },

    async compareDepartments(request: CompareRequest): Promise<CompareResponse> {
      const catalog = await getCatalog();
      const departments: DepartmentStatistics[] = [];
      const suppressedSizes = new Set<string>();
      for (const id of request.departmentIds) {
        const filters = { ...request.filters, departmentIds: [id] };
        const stats = await getStatistics({
          filters,
          groupBy: "department",
          metrics: request.metrics.length ? request.metrics : ["sample_count"],
        }, catalog);
        const row = stats.rows[0];
        if (!row) throw new Error("Department aggregate missing");
        if (row.sampleSize === null) suppressedSizes.add(id);
        const breakdowns: DepartmentStatistics["breakdowns"] = {};
        for (const dimension of request.breakdowns) {
          const categories = await getStatistics({
            filters,
            groupBy: dimension,
            metrics: ["category_count", "category_pct"],
          }, catalog);
          breakdowns[dimension] = categories.rows;
        }
        departments.push({
          id,
          label: row.label,
          sampleSize: row.sampleSize ?? 0,
          metrics: row.metrics,
          breakdowns,
        });
      }
      const data = buildComparison(request, departments);
      for (const department of data.departments) {
        if (suppressedSizes.has(department.id)) department.sampleSize = null;
      }
      if (!request.metrics.includes("sample_count")) {
        for (const department of data.departments) delete department.metrics.sample_count;
      }
      return {
        data,
        meta: metadata(
          catalog,
          { ...request.filters, departmentIds: [...request.departmentIds].sort() },
          suppressedSizes.size
            ? null
            : departments.reduce((sum, department) => sum + (department.sampleSize ?? 0), 0),
        ),
      };
    },
  };
}
