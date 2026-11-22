import { categoryOptions, loadAuditedCatalog, validateAuditedFilters, type AuditedCatalog } from "../data/catalog.ts";
import { queryStatisticsOn, withReadSnapshot, type ReadSnapshotTransaction } from "../db/queries/statistics.ts";
import type { Filters } from "../contracts/common.ts";
import type { StatisticsRequest } from "../contracts/statistics.ts";
import { buildCategoryRows, buildDepartmentAggregates, buildDepartmentRows } from "./statistics.ts";
import { STATISTICS_BUDGET_MS, throwIfStatisticsBudgetExceeded, type StatisticsBudget } from "./statistics-budget.ts";

export async function getCatalog(budget?: Pick<StatisticsBudget, "signal" | "deadline">) {
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  const catalog = await loadAuditedCatalog();
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  return catalog;
}

export function validateCatalogFilters(catalog: AuditedCatalog, filters: Filters = {}) {
  validateAuditedFilters(catalog, filters);
}

export async function getStatistics(
  request: StatisticsRequest,
  catalog: AuditedCatalog,
  budget?: Pick<StatisticsBudget, "signal" | "deadline">,
) {
  return withReadSnapshot(
    (tx) => getStatisticsInSnapshot(request, catalog, tx, budget),
    STATISTICS_BUDGET_MS,
    undefined,
    budget,
  );
}

export async function getStatisticsInSnapshot(
  request: StatisticsRequest,
  catalog: AuditedCatalog,
  tx: ReadSnapshotTransaction,
  budget?: Pick<StatisticsBudget, "signal" | "deadline">,
) {
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  const filters = request.filters ?? {};
  validateCatalogFilters(catalog, filters);
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  const groups = await queryStatisticsOn(tx, catalog, request.groupBy, filters, true, budget);
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  if (request.groupBy === "department") {
    const requested = new Set<string>(filters.departmentIds ?? []);
    const departments = filters.departmentIds
      ? catalog.departments.filter((d) => requested.has(d.id))
      : catalog.departments;
    const rows = buildDepartmentAggregates(groups, departments);
    const unmapped = groups.find((group) => group.key === "__unmapped__");
    return {
      rows: buildDepartmentRows(request, rows, [
        ...departments.map(({ id, label }) => ({ id, label })),
        ...(unmapped ? [{ id: "__unmapped__", label: "Departamento no mapeado" }] : []),
      ]),
      sampleSize: rows.some((row) => row.n > 0 && row.n < 5)
        ? null
        : rows.reduce((sum, row) => sum + row.n, 0),
    };
  }

  const dimension = categoryOptions(catalog, request.groupBy);
  const mapped: { key: string; label: string; count: number }[] = [];
  for (const item of dimension) {
    mapped.push({
      key: item.id,
      label: item.label,
      count: groups.filter((group) => item.values.includes(group.key.slice(2))).reduce((sum, group) => sum + group.n, 0),
    });
  }
  const missing = groups.find((group) => group.key === "__missing__");
  if (missing) mapped.push({ key: "__missing__", label: "Sin dato", count: missing.n });
  const unmapped = groups.filter((group) => group.key !== "__missing__" && !dimension.some((item) => item.values.includes(group.key.slice(2))));
  if (unmapped.length) {
    mapped.push({
      key: "__unmapped__",
      label: "Categoría no mapeada",
      count: unmapped.reduce((sum, group) => sum + group.n, 0),
    });
  }
  const rows = buildCategoryRows(mapped, groups.reduce((sum, group) => sum + group.n, 0), request.metrics as ("category_count" | "category_pct")[]);
  const sampleSize = groups.reduce((sum, group) => sum + group.n, 0);
  return {
    rows,
    sampleSize: sampleSize > 0 && sampleSize < 5 ? null : sampleSize,
  };
}
