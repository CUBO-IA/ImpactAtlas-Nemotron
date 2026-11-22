import type { StatisticsRequest } from "../contracts/statistics.ts";
import { suppressBreakdown, suppressMetric, suppressBinaryRate } from "./privacy.ts";

export type StatisticsRow = {
  key: string;
  label: string;
  sampleSize: number | null;
  metrics: Record<string, {
    value: number | null;
    unit: "records" | "usd_estimated" | "percent";
    validN: number | null;
    missingN: number | null;
    suppressed: boolean;
    reason: "empty" | "insufficient_sample" | "complementary_suppression" | null;
  }>;
};

export type AggregateGroup = {
  key: string;
  label: string;
  n: number;
  incomeValidN: number;
  incomeMean: number | null;
  incomeMedian: number | null;
  financeValidN: number;
  financeExcludedN: number;
};

export function buildDepartmentAggregates(
  groups: readonly AggregateGroup[],
  departments: readonly { id: string; label: string }[],
): AggregateGroup[] {
  const rows = departments.map((department) => {
    const group = groups.find((candidate) => candidate.key === department.id);
    return group
      ? { ...group, label: department.label }
      : { key: department.id, label: department.label, n: 0, incomeValidN: 0, incomeMean: null, incomeMedian: null, financeValidN: 0, financeExcludedN: 0 };
  });
  const unmapped = groups.find((group) => group.key === "__unmapped__");
  if (unmapped) rows.push({ ...unmapped, label: "Departamento no mapeado" });
  return rows;
}

export function buildDepartmentRows(
  request: StatisticsRequest,
  groups: readonly AggregateGroup[],
  requestedKeys: readonly { id: string; label: string }[],
): StatisticsRow[] {
  return requestedKeys.map(({ id, label }) => {
    const group = groups.find((candidate) => candidate.key === id);
    const n = group?.n ?? 0;
    const empty = n === 0;
    const metrics: StatisticsRow["metrics"] = {};
    for (const metric of request.metrics) {
      let value: number | null = null;
      let validN: number | null = null;
      let missingN: number | null = null;
      let suppressed = false;
      let unit: "records" | "usd_estimated" | "percent" = "records";
      let reason: StatisticsRow["metrics"][string]["reason"] = empty ? "empty" : null;
      if (metric === "sample_count") {
        value = n;
        validN = n;
        missingN = 0;
      } else if (metric === "income_mean" || metric === "income_median") {
        unit = "usd_estimated";
        const count = group?.incomeValidN ?? 0;
        value = metric === "income_mean" ? group?.incomeMean ?? null : group?.incomeMedian ?? null;
        validN = count;
        missingN = n - count;
        if (count === 0) reason = "empty";
      } else if (metric === "financial_exclusion_pct") {
        unit = "percent";
        const count = group?.financeValidN ?? 0;
        const numerator = group?.financeExcludedN ?? 0;
        validN = count;
        missingN = n - count;
        const binaryRateSuppressed = suppressBinaryRate(numerator, count);
        if (binaryRateSuppressed) {
          value = null;
          validN = null;
          missingN = null;
          reason = "insufficient_sample";
          suppressed = true;
        } else if (count > 0) {
          value = 100 * numerator / count;
        } else {
          reason = "empty";
        }
      }
      const result = suppressMetric(
        {
          value,
          unit,
          validN,
          missingN,
          suppressed,
          reason,
        },
        n,
      );
      metrics[metric] = result;
    }
    const sampleSuppressed = n > 0 && n < 5;
    return {
      key: id,
      label: sampleSuppressed ? "Muestra insuficiente" : label,
      sampleSize: sampleSuppressed ? null : n,
      metrics,
    };
  });
}

export function buildCategoryRows(
  groups: readonly { key: string; label: string; count: number }[],
  cohortSize: number,
  requestedMetrics: readonly ("category_count" | "category_pct")[],
): StatisticsRow[] {
  const safeGroups = suppressBreakdown(groups, cohortSize);
  return safeGroups.map((group) => {
    const count = group.count;
    const suppressed = count === null;
    const metrics: StatisticsRow["metrics"] = {};
    for (const id of requestedMetrics) {
      metrics[id] = suppressed
        ? { value: null, unit: id === "category_count" ? "records" : "percent", validN: null, missingN: null, suppressed: true, reason: "insufficient_sample" }
        : {
            value: id === "category_count" ? count : cohortSize === 0 ? null : 100 * count / cohortSize,
            unit: id === "category_count" ? "records" : "percent",
            validN: count,
            missingN: cohortSize - count,
            suppressed: false,
            reason: cohortSize === 0 ? "empty" : null,
          };
    }
    return {
      key: group.key,
      label: suppressed ? "Muestra insuficiente" : group.label,
      sampleSize: suppressed ? null : count,
      metrics,
    };
  });
}
