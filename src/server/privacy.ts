export const MINIMUM_PUBLISHABLE_N = 5;

export type SuppressibleMetric = {
  value: number | null;
  validN: number | null;
  missingN: number | null;
  suppressed: boolean;
  reason: "empty" | "insufficient_sample" | "complementary_suppression" | null;
};

export function suppressMetric<T extends SuppressibleMetric>(
  metric: T,
  cohortSize: number,
): T {
  const hasSmallDenominator =
    (metric.validN !== null && metric.validN > 0 && metric.validN < MINIMUM_PUBLISHABLE_N) ||
    (metric.missingN !== null && metric.missingN > 0 && metric.missingN < MINIMUM_PUBLISHABLE_N);
  if ((cohortSize > 0 && cohortSize < MINIMUM_PUBLISHABLE_N) || hasSmallDenominator) {
    return {
      ...metric,
      value: null,
      validN: null,
      missingN: null,
      suppressed: true,
      reason: "insufficient_sample",
    };
  }
  return metric;
}

/**
 * Hide the smallest non-empty bucket whenever it could be recovered from a
 * published cohort total by subtraction. Counts are not returned here.
 */
export function suppressBreakdown<T extends { count: number }>(
  buckets: readonly T[],
  cohortSize: number,
): Array<T | (Omit<T, "count"> & { count: null; suppressed: true })> {
  const small = buckets.filter((bucket) => bucket.count > 0 && bucket.count < MINIMUM_PUBLISHABLE_N);
  const suppressed = new Set<T>(small);
  if (small.length === 1 && cohortSize >= MINIMUM_PUBLISHABLE_N) {
    const remaining = buckets.filter((bucket) => bucket.count >= MINIMUM_PUBLISHABLE_N);
    const complement = remaining.sort((a, b) => a.count - b.count)[0];
    if (complement) suppressed.add(complement);
  }
  return buckets.map((bucket) =>
    suppressed.has(bucket)
      ? { ...bucket, count: null, suppressed: true as const }
      : bucket,
  );
}

export function suppressBinaryRate(
  numerator: number,
  denominator: number,
): boolean {
  const complement = denominator - numerator;
  return (
    denominator > 0 &&
    ((numerator > 0 && numerator < MINIMUM_PUBLISHABLE_N) ||
      (complement > 0 && complement < MINIMUM_PUBLISHABLE_N))
  );
}
