import type { Filters } from "@/src/contracts/common";

export function filterSearchParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.income?.min !== undefined) params.set("minIncome", String(filters.income.min));
  if (filters.income?.max !== undefined) params.set("maxIncome", String(filters.income.max));
  if (filters.educationIds?.length) params.set("education", filters.educationIds.join(","));
  if (filters.occupationIds?.length) params.set("occupation", filters.occupationIds.join(","));
  if (filters.goalIds?.length) params.set("goal", filters.goalIds.join(","));
  return params;
}
