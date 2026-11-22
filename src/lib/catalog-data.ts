import type { CatalogResponse } from "../contracts/catalog.ts";
import type { DepartmentId } from "../contracts/common.ts";

export const DEPARTMENTS: { id: DepartmentId; label: string; geoFeatureId: string }[] = [
  { id: "ahuachapan", label: "Ahuachapán", geoFeatureId: "ahuachapan" },
  { id: "cabanas", label: "Cabañas", geoFeatureId: "cabanas" },
  { id: "chalatenango", label: "Chalatenango", geoFeatureId: "chalatenango" },
  { id: "cuscatlan", label: "Cuscatlán", geoFeatureId: "cuscatlan" },
  { id: "la-libertad", label: "La Libertad", geoFeatureId: "la-libertad" },
  { id: "la-paz", label: "La Paz", geoFeatureId: "la-paz" },
  { id: "la-union", label: "La Unión", geoFeatureId: "la-union" },
  { id: "morazan", label: "Morazán", geoFeatureId: "morazan" },
  { id: "san-miguel", label: "San Miguel", geoFeatureId: "san-miguel" },
  { id: "san-salvador", label: "San Salvador", geoFeatureId: "san-salvador" },
  { id: "san-vicente", label: "San Vicente", geoFeatureId: "san-vicente" },
  { id: "santa-ana", label: "Santa Ana", geoFeatureId: "santa-ana" },
  { id: "sonsonate", label: "Sonsonate", geoFeatureId: "sonsonate" },
  { id: "usulutan", label: "Usulután", geoFeatureId: "usulutan" },
];

export const EDUCATION: { id: string; label: string }[] = [
  { id: "sin-escolaridad", label: "Sin escolaridad" },
  { id: "primaria-incompleta", label: "Primaria incompleta" },
  { id: "primaria-completa", label: "Primaria completa" },
  { id: "secundaria-incompleta", label: "Secundaria incompleta" },
  { id: "secundaria-completa", label: "Secundaria completa" },
  { id: "tecnico", label: "Técnico" },
  { id: "universitario", label: "Universitario" },
];

export const OCCUPATIONS: { id: string; label: string }[] = [
  { id: "agricultora", label: "Agricultora" },
  { id: "artesano", label: "Artesano" },
  { id: "comerciante", label: "Comerciante" },
  { id: "contador", label: "Contador" },
  { id: "empleado-de-tienda", label: "Empleado de tienda" },
  { id: "empleado-publico", label: "Empleado público" },
  { id: "empresario", label: "Empresario" },
  { id: "ingeniero", label: "Ingeniero" },
  { id: "jornalero-agricola", label: "Jornalero agrícola" },
  { id: "maestro-rural", label: "Maestro rural" },
  { id: "operario-de-maquila", label: "Operario de maquila" },
  { id: "profesional", label: "Profesional" },
  { id: "tecnico", label: "Técnico" },
  { id: "trabajadora-domestica", label: "Trabajadora doméstica" },
  { id: "vendedora-ambulante", label: "Vendedora ambulante" },
];

export const GOALS: { id: string; label: string }[] = [
  { id: "conseguir-trabajo", label: "Conseguir trabajo formal con prestaciones" },
  { id: "educacion-hijos", label: "Que mis hijos terminen el bachillerato" },
  { id: "enviar-remesas", label: "Enviar remesas a mi familia" },
  { id: "emergencia-medica", label: "Ahorrar para una emergencia médica" },
  { id: "negocio-propio", label: "Tener un negocio propio" },
  { id: "credito-casa", label: "Acceder a crédito para mejorar mi casa" },
  { id: "comprar-terreno", label: "Comprar un terreno" },
  { id: "capacitacion-tecnica", label: "Mejorar mis ingresos con capacitación técnica" },
];

export const INDICATORS: CatalogResponse["data"]["indicators"] = [
  {
    id: "sample_count",
    label: "Tamaño de muestra",
    unit: "records",
    allowedGroupBy: ["department"],
    definition: "Total de perfiles analizados en el corte seleccionado.",
  },
  {
    id: "income_mean",
    label: "Ingreso promedio estimado",
    unit: "usd_estimated",
    allowedGroupBy: ["department"],
    definition: "Media aritmética del ingreso mensual estimado en dólares estadounidenses.",
  },
  {
    id: "income_median",
    label: "Ingreso mediano estimado",
    unit: "usd_estimated",
    allowedGroupBy: ["department"],
    definition: "Mediana del ingreso mensual estimado en dólares estadounidenses.",
  },
  {
    id: "financial_exclusion_pct",
    label: "Tasa de exclusión financiera",
    unit: "percent",
    allowedGroupBy: ["department"],
    definition: "Porcentaje de personas sin acceso al sistema financiero tradicional.",
  },
  {
    id: "category_count",
    label: "Frecuencia por categoría",
    unit: "records",
    allowedGroupBy: ["education", "occupation", "goal"],
    definition: "Cantidad de perfiles correspondientes a la categoría seleccionada.",
  },
  {
    id: "category_pct",
    label: "Porcentaje por categoría",
    unit: "percent",
    allowedGroupBy: ["education", "occupation", "goal"],
    definition: "Proporción relativa de la categoría sobre el universo filtrado.",
  },
];

// Mapping dictionaries
export const DEPARTMENT_ID_TO_DB: Record<string, string> = {
  ahuachapan: "Ahuachapán",
  cabanas: "Cabañas",
  chalatenango: "Chalatenango",
  cuscatlan: "Cuscatlán",
  "la-libertad": "La Libertad",
  "la-paz": "La Paz",
  "la-union": "La Unión",
  morazan: "Morazán",
  "san-miguel": "San Miguel",
  "san-salvador": "San Salvador",
  "san-vicente": "San Vicente",
  "santa-ana": "Santa Ana",
  sonsonate: "Sonsonate",
  usulutan: "Usulután",
};

export const DB_TO_DEPARTMENT_ID: Record<string, DepartmentId> = Object.fromEntries(
  Object.entries(DEPARTMENT_ID_TO_DB).map(([k, v]) => [v, k as DepartmentId])
);

export const EDUCATION_ID_TO_DB: Record<string, string> = Object.fromEntries(
  EDUCATION.map((e) => [e.id, e.label])
);

export const DB_TO_EDUCATION_ID: Record<string, string> = Object.fromEntries(
  EDUCATION.map((e) => [e.label, e.id])
);

export const OCCUPATION_ID_TO_DB: Record<string, string> = Object.fromEntries(
  OCCUPATIONS.map((o) => [o.id, o.label])
);

export const DB_TO_OCCUPATION_ID: Record<string, string> = Object.fromEntries(
  OCCUPATIONS.map((o) => [o.label, o.id])
);

export const GOAL_ID_TO_DB: Record<string, string> = Object.fromEntries(
  GOALS.map((g) => [g.id, g.label])
);

export const DB_TO_GOAL_ID: Record<string, string> = Object.fromEntries(
  GOALS.map((g) => [g.label, g.id])
);
