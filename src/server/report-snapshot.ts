import type { Filters } from "../contracts/common.ts";
import type { ReportRequest } from "../contracts/reports.ts";
import {
  ReportServiceUnavailableError,
  type DepartmentMetric,
  type ReportCategory,
  type ReportMetric,
  type ReportSection,
  type ReportSnapshot,
  type ReportSnapshotProvider,
} from "./reports.ts";
import { CatalogUnavailableError, InvalidCatalogFilterError, type AuditedCatalog } from "../data/catalog.ts";
import { getCatalog, getStatisticsInSnapshot, validateCatalogFilters } from "./data-service.ts";
import { queryStatisticsOn, withReadSnapshot, type ReadSnapshotTransaction } from "../db/queries/statistics.ts";
import { suppressBinaryRate, suppressMetric } from "./privacy.ts";
import type { AggregateGroup, StatisticsRow } from "./statistics.ts";

const warningNonRepresentative =
  "Datos de muestra; no necesariamente representativos de El Salvador. Asociaciones no implican causalidad.";

export function toReportCategory(row: StatisticsRow): ReportCategory {
  const count = row.metrics.category_count;
  const percent = row.metrics.category_pct;
  const suppressed = Boolean(count?.suppressed || percent?.suppressed);
  return {
    label: row.label,
    count: suppressed ? null : count?.value ?? null,
    percent: suppressed ? null : percent?.value ?? null,
    suppressed,
  };
}

function reportMetric(metric: DepartmentMetric, group: AggregateGroup): ReportMetric {
  const n = group.n;
  let value: number | null;
  let unit: ReportMetric["unit"];
  let validN: number | null;
  let missingN: number | null;
  let reason: ReportMetric["reason"] = n === 0 ? "empty" : null;
  let suppressed = false;

  if (metric === "sample_count") {
    value = n;
    unit = "records";
    validN = n;
    missingN = 0;
  } else if (metric === "income_mean" || metric === "income_median") {
    value = metric === "income_mean" ? group.incomeMean : group.incomeMedian;
    unit = "usd_estimated";
    validN = group.incomeValidN;
    missingN = n - group.incomeValidN;
    if (validN === 0) reason = "empty";
  } else {
    unit = "percent";
    validN = group.financeValidN;
    missingN = n - group.financeValidN;
    if (suppressBinaryRate(group.financeExcludedN, group.financeValidN)) {
      value = null;
      validN = null;
      missingN = null;
      suppressed = true;
      reason = "insufficient_sample";
    } else if (group.financeValidN === 0) {
      value = null;
      reason = "empty";
    } else {
      value = 100 * group.financeExcludedN / group.financeValidN;
    }
  }
  return suppressMetric(
    { value, unit, validN, missingN, suppressed, reason },
    n,
  );
}

export function buildReportSnapshot(input: {
  request: ReportRequest;
  catalog: AuditedCatalog;
  generatedAt: string;
  snapshotId: string;
  aggregate: AggregateGroup;
  sections: Partial<Record<ReportSection, readonly ReportCategory[]>>;
}): ReportSnapshot {
  const { request, catalog, aggregate } = input;
  const indicators = Object.fromEntries(
    (["sample_count", "income_mean", "income_median", "financial_exclusion_pct"] as const)
      .map((metric) => [metric, reportMetric(metric, aggregate)]),
  ) as Record<DepartmentMetric, ReportMetric>;
  const sampleSize = aggregate.n > 0 && aggregate.n < 5 ? null : aggregate.n;
  return {
    snapshotId: input.snapshotId,
    generatedAt: input.generatedAt,
    datasetId: catalog.dataset.id,
    datasetVersion: catalog.dataset.version,
    appliedFilters: request.filters ?? {} satisfies Filters,
    sampleSize,
    indicators,
    sections: input.sections,
    warnings: [
      warningNonRepresentative,
      `Ingresos estimados; período ${catalog.dataset.incomePeriod ?? "no documentado"}.`,
    ],
  };
}

async function querySnapshot(
  request: ReportRequest,
  catalog: AuditedCatalog,
  tx: ReadSnapshotTransaction,
): Promise<ReportSnapshot> {
  const filters = request.filters ?? {};
  validateCatalogFilters(catalog, filters);
  const [aggregate] = await queryStatisticsOn(tx, catalog, "department", filters, false);
  const total = aggregate ?? {
    key: "__all__",
    label: "__all__",
    n: 0,
    incomeValidN: 0,
    incomeMean: null,
    incomeMedian: null,
    financeValidN: 0,
    financeExcludedN: 0,
  };

  const sections: Partial<Record<ReportSection, readonly ReportCategory[]>> = {};
  const sectionGroups = {
    education: "education",
    occupation: "occupation",
    goals: "goal",
  } as const;
  for (const section of request.sections) {
    if (section === "summary" || section === "ai_analysis") continue;
    const data = await getStatisticsInSnapshot({
      groupBy: sectionGroups[section],
      filters,
      metrics: ["category_count", "category_pct"],
    }, catalog, tx);
    sections[section] = data.rows.map(toReportCategory);
  }
  return buildReportSnapshot({
    request,
    catalog,
    aggregate: total,
    sections,
    snapshotId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
  });
}

export function createReportSnapshotProvider(): ReportSnapshotProvider {
  return {
    async getSnapshot(request) {
      try {
        const catalog = await getCatalog();
        return await withReadSnapshot((tx) => querySnapshot(request, catalog, tx), 5000, 25_000);
      } catch (error) {
        if (error instanceof InvalidCatalogFilterError) throw error;
        if (error instanceof ReportServiceUnavailableError) throw error;
        if (error instanceof CatalogUnavailableError) {
          throw new ReportServiceUnavailableError("El catálogo auditado no está disponible.");
        }
        throw new ReportServiceUnavailableError("No fue posible obtener un snapshot estadístico.");
      }
    },
  };
}
