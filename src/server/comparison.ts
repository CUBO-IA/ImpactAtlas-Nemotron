import type { CompareRequest, CompareResponse } from "../contracts/compare.ts";
import type { StatisticsRow } from "./statistics.ts";

type ComparedDepartment = CompareResponse["data"]["departments"][number];

export type DepartmentStatistics = {
  id: ComparedDepartment["id"];
  label: string;
  sampleSize: number | null;
  metrics: ComparedDepartment["metrics"];
  breakdowns: Partial<Record<"education" | "occupation" | "goal", StatisticsRow[]>>;
};

const units = {
  sample_count: "records",
  income_mean: "usd_estimated",
  income_median: "usd_estimated",
  financial_exclusion_pct: "percentage_points",
} as const;

export function buildComparison(
  request: CompareRequest,
  rows: readonly DepartmentStatistics[],
): CompareResponse["data"] {
  const reference = rows.find((row) => row.id === request.referenceDepartmentId);
  return {
    referenceDepartmentId: request.referenceDepartmentId,
    departments: rows.map((row) => ({
      id: row.id,
      label: row.label,
      sampleSize: row.sampleSize,
      metrics: row.metrics,
      differences: request.metrics.map((metricId) => {
        const value = row.metrics[metricId]?.value;
        const referenceValue = reference?.metrics[metricId]?.value;
        return {
          metricId,
          value: value === null || value === undefined || referenceValue === null || referenceValue === undefined
            ? null
            : value - referenceValue,
          unit: units[metricId],
        };
      }),
      breakdowns: Object.fromEntries(
        request.breakdowns.map((dimension) => [dimension, row.breakdowns[dimension] ?? []]),
      ),
    })),
  };
}
