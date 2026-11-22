import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Filters } from "../contracts/common.ts";
import type { CatalogResponse } from "@/src/contracts/catalog";
import type { DepartmentId } from "@/src/contracts/common";
import type { GroupBy, MetricId } from "@/src/contracts/common";

const dimensionSchema = z.record(z.string().min(1), z.object({
  label: z.string().min(1),
  values: z.array(z.string()),
}));

const auditSchema = z.strictObject({
  audited: z.literal(true),
  dataset: z.strictObject({
    id: z.string().min(1),
    version: z.string().min(1),
    sourceLabel: z.string().min(1),
    collectionPeriod: z.string().nullable(),
    incomePeriod: z.string().nullable(),
  }),
  departments: z.array(z.strictObject({
    id: z.string(),
    label: z.string().min(1),
    geoFeatureId: z.string().min(1),
    sqlValues: z.array(z.string().min(1)).min(1),
  })),
  education: dimensionSchema,
  occupations: dimensionSchema,
  goals: dimensionSchema,
});

export type AuditedCatalog = z.infer<typeof auditSchema>;
export class CatalogUnavailableError extends Error {}
export class InvalidCatalogFilterError extends Error {}

export function resolveCategoryFilter(
  source: Record<string, { values: string[] }>,
  ids?: string[],
) {
  if (!ids) return { active: false, includesMissing: false, values: [] as string[] };
  return {
    active: true,
    includesMissing: ids.includes("__missing__"),
    values: [...new Set(ids.filter((id) => id !== "__missing__").flatMap((id) => source[id]?.values ?? []))],
  };
}

export function validateAuditedFilters(catalog: AuditedCatalog, filters: Filters = {}) {
  const dimensions = [
    [filters.educationIds, catalog.education],
    [filters.occupationIds, catalog.occupations],
    [filters.goalIds, catalog.goals],
  ] as const;
  const departmentIds = new Set(catalog.departments.map((department) => department.id));
  if (filters.departmentIds?.some((id) => !departmentIds.has(id))) {
    throw new InvalidCatalogFilterError();
  }
  for (const [ids, options] of dimensions) {
    if (ids?.some((id) => !Object.hasOwn(options, id))) {
      throw new InvalidCatalogFilterError();
    }
  }
}

export function categoryOptions(catalog: AuditedCatalog, groupBy: Exclude<GroupBy, "department">) {
  const source = groupBy === "education" ? catalog.education
    : groupBy === "occupation" ? catalog.occupations
      : catalog.goals;
  return Object.entries(source)
    .filter(([id]) => id !== "__missing__")
    .map(([id, item]) => ({ id, label: item.label, values: item.values }));
}

const indicators: Record<MetricId, { label: string; unit: "records" | "usd_estimated" | "percent"; allowedGroupBy: GroupBy[]; definition: string }> = {
  sample_count: { label: "Registros de la muestra", unit: "records", allowedGroupBy: ["department"], definition: "Cantidad de registros filtrados; no representa habitantes." },
  income_mean: { label: "Ingreso promedio estimado", unit: "usd_estimated", allowedGroupBy: ["department"], definition: "Promedio de ingresos válidos estimados en USD." },
  income_median: { label: "Ingreso mediano estimado", unit: "usd_estimated", allowedGroupBy: ["department"], definition: "Mediana de ingresos válidos estimados en USD." },
  financial_exclusion_pct: { label: "Sin acceso financiero", unit: "percent", allowedGroupBy: ["department"], definition: "Porcentaje con sin_acceso_financiero = true entre booleanos conocidos." },
  category_count: { label: "Registros por categoría", unit: "records", allowedGroupBy: ["education", "occupation", "goal"], definition: "Cantidad de registros en cada categoría observada." },
  category_pct: { label: "Porcentaje por categoría", unit: "percent", allowedGroupBy: ["education", "occupation", "goal"], definition: "Porcentaje de registros de cada categoría sobre el universo filtrado." },
};

let cached: AuditedCatalog | null | undefined;

function catalogPath(): string | URL | undefined {
  return process.env["DATA_CATALOG_PATH"];
}

export async function loadAuditedCatalog(): Promise<AuditedCatalog> {
  if (cached !== undefined) {
    if (cached) return cached;
    throw new CatalogUnavailableError();
  }
  const path = catalogPath();
  if (!path) {
    cached = null;
    throw new CatalogUnavailableError();
  }
  try {
    cached = auditSchema.parse(JSON.parse(await readFile(path, "utf8")));
  } catch {
    cached = null;
    throw new CatalogUnavailableError();
  }
  const ids = cached.departments.map((item) => item.id);
  if (
    new Set(ids).size !== ids.length ||
    ids.length !== 14 ||
    new Set(ids).size !== 14 ||
    ids.some((id) => ![
      "ahuachapan", "cabanas", "chalatenango", "cuscatlan", "la-libertad",
      "la-paz", "la-union", "morazan", "san-miguel", "san-salvador",
      "san-vicente", "santa-ana", "sonsonate", "usulutan",
    ].includes(id))
  ) {
    cached = null;
    throw new CatalogUnavailableError();
  }
  for (const dimension of [cached.education, cached.occupations, cached.goals]) {
    const seenValues = new Set<string>();
    for (const [id, item] of Object.entries(dimension)) {
      if (id === "__missing__" && item.values.length !== 0) {
        cached = null;
        throw new CatalogUnavailableError();
      }
      for (const value of item.values) {
        if (seenValues.has(value)) {
          cached = null;
          throw new CatalogUnavailableError();
        }
        seenValues.add(value);
      }
    }
  }
  const departmentValues = new Set<string>();
  for (const department of cached.departments) {
    for (const value of department.sqlValues) {
      if (departmentValues.has(value)) {
        cached = null;
        throw new CatalogUnavailableError();
      }
      departmentValues.add(value);
    }
  }
  return cached;
}

export function toCatalogResponse(catalog: AuditedCatalog): CatalogResponse["data"] {
  const toItems = (dimension: Record<string, { label: string; values: string[] }>) =>
    Object.entries(dimension).map(([id, value]) => ({ id, label: value.label }));
  return {
    departments: catalog.departments.map(({ id, label, geoFeatureId }) => ({
      id: id as DepartmentId,
      label,
      geoFeatureId,
    })),
    education: toItems(catalog.education),
    occupations: toItems(catalog.occupations),
    goals: toItems(catalog.goals),
    indicators: Object.entries(indicators).map(([id, item]) => ({ id: id as MetricId, ...item })),
    income: { currency: "USD", period: catalog.dataset.incomePeriod },
    dataset: {
      id: catalog.dataset.id,
      version: catalog.dataset.version,
      sourceLabel: catalog.dataset.sourceLabel,
      collectionPeriod: catalog.dataset.collectionPeriod,
      representative: false,
      limitations: [
        "Datos de muestra; no necesariamente representativos de El Salvador.",
        "Ingresos estimados. Asociaciones no implican causalidad.",
      ],
    },
    privacy: { minimumPublishableN: 5 },
  };
}

export function resetCatalogCacheForTests() {
  cached = undefined;
}
