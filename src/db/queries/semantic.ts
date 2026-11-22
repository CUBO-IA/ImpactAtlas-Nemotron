import {
  resolveCategoryFilter,
  validateAuditedFilters,
  type AuditedCatalog,
} from "../../data/catalog.ts";
import type { Filters } from "../../contracts/common.ts";
import { withReadSnapshot, type ReadSnapshotTransaction } from "./statistics.ts";
type SafeCategoryRow = { category_id: string; n: number };

const textCodec = { codecId: "pg/text@1" } as const;
const numberCodec = { codecId: "pg/float8@1" } as const;

export function semanticSearchEnabled(
  env: { SEMANTIC_SEARCH_ENABLED?: string; SEMANTIC_SEARCH_AUDIT?: string } =
    process.env as unknown as { SEMANTIC_SEARCH_ENABLED?: string; SEMANTIC_SEARCH_AUDIT?: string },
): boolean {
  return env.SEMANTIC_SEARCH_ENABLED === "true" && env.SEMANTIC_SEARCH_AUDIT === "confirmed";
}

function validateTopK(topK: number): void {
  if (!Number.isInteger(topK) || topK < 1 || topK > 20) {
    throw new RangeError("topK must be an integer from 1 to 20");
  }
}

export function semanticEvidence() {
  return { status: "abstained" as const, reason: "no_publishable_aggregate" as const };
}

export type SemanticEvidence =
  | { status: "ok"; interpretation: "exploratory_not_prevalence"; categories: string[] }
  | ReturnType<typeof semanticEvidence>;

export function publishableCategories(
  rows: readonly SafeCategoryRow[],
  catalog: AuditedCatalog,
  k: number,
): SemanticEvidence {
  const idToLabel = new Map(Object.entries(catalog.goals).map(([id, item]) => [id, item.label]));
  const categories = [...new Set(rows
    .filter((row) => row.n >= k)
    .map((row) => idToLabel.get(row.category_id))
    .filter((label): label is string => label !== undefined))];
  return categories.length
    ? { status: "ok", interpretation: "exploratory_not_prevalence", categories }
    : semanticEvidence();
}

/**
 * Prisma-backed local query. The CTE limits nearest candidates before grouping;
 * only audited goal labels with at least k matches leave the DB layer.
 */
export async function searchSemantic(
  vector: readonly number[],
  catalog: AuditedCatalog,
  filters: Filters = {},
  topK = 20,
): Promise<SemanticEvidence> {
  if (vector.length !== 768 || vector.some((n) => !Number.isFinite(n))) {
    throw new TypeError("Invalid semantic query vector");
  }
  validateTopK(topK);
  if (topK < 5) throw new RangeError("topK must be at least 5 to publish a category");
  validateAuditedFilters(catalog, filters);
  if (!semanticSearchEnabled()) return semanticEvidence();
  const k = 5;

  const selected = new Set<string>(filters.departmentIds ?? []);
  const departments = filters.departmentIds
    ? catalog.departments.filter((item) => selected.has(item.id)).flatMap((item) => item.sqlValues)
    : [];
  const education = resolveCategoryFilter(catalog.education, filters.educationIds);
  const occupation = resolveCategoryFilter(catalog.occupations, filters.occupationIds);
  const goals = resolveCategoryFilter(catalog.goals, filters.goalIds);
  const owners = new Map<string, string[]>();
  for (const [id, item] of Object.entries(catalog.goals)) {
    for (const value of new Set(item.values)) {
      owners.set(value, [...(owners.get(value) ?? []), id]);
    }
  }
  const categoryMap = [...owners]
    .filter(([, ids]) => ids.length === 1)
    .map(([value, [id]]) => ({ id, value }));
  const run = async (snapshot: ReadSnapshotTransaction) => {
    const query = snapshot.raw.sql`
      WITH nearest AS (
        SELECT sample.meta_principal
        FROM public."NemotronSvMuestra" AS sample
        WHERE (jsonb_array_length(${JSON.stringify(departments)}::jsonb) = 0 OR sample.departamento IN
          (SELECT jsonb_array_elements_text(${JSON.stringify(departments)}::jsonb)))
          AND (NOT ${filters.income !== undefined}::boolean OR (
            sample.ingreso_estimado_usd >= 0
            AND sample.ingreso_estimado_usd NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
            AND (NOT ${filters.income?.min !== undefined}::boolean OR sample.ingreso_estimado_usd >= ${filters.income?.min ?? 0}::float8)
            AND (NOT ${filters.income?.max !== undefined}::boolean OR sample.ingreso_estimado_usd <= ${filters.income?.max ?? 0}::float8)
          ))
          AND (NOT ${education.active}::boolean OR sample.nivel_educativo IN
            (SELECT jsonb_array_elements_text(${JSON.stringify(education.values)}::jsonb)) OR
            (${education.includesMissing}::boolean AND (sample.nivel_educativo IS NULL OR BTRIM(sample.nivel_educativo) = '')))
          AND (NOT ${occupation.active}::boolean OR sample.ocupacion IN
            (SELECT jsonb_array_elements_text(${JSON.stringify(occupation.values)}::jsonb)) OR
            (${occupation.includesMissing}::boolean AND (sample.ocupacion IS NULL OR BTRIM(sample.ocupacion) = '')))
          AND (NOT ${goals.active}::boolean OR sample.meta_principal IN
            (SELECT jsonb_array_elements_text(${JSON.stringify(goals.values)}::jsonb)) OR
            (${goals.includesMissing}::boolean AND (sample.meta_principal IS NULL OR BTRIM(sample.meta_principal) = '')))
        ORDER BY sample.embedding <=> ${`[${vector.join(",")}]`}::vector
        LIMIT ${topK}
      ),
      category_map AS (
        SELECT item.id, item.value
        FROM jsonb_to_recordset(${JSON.stringify(categoryMap)}::jsonb) AS item(id text, value text)
      )
      SELECT category_map.id AS category_id, COUNT(*)::float8 AS n
      FROM nearest
      JOIN category_map ON category_map.value = nearest.meta_principal
      GROUP BY category_map.id
      HAVING COUNT(*) >= ${k}
    `.returnsRow({ category_id: textCodec, n: numberCodec }).build();
    return await snapshot.query(query);
  };

  // Existing helper sets transaction READ ONLY + statement_timeout and releases
  // the connection after this read. No prompt/evidence is sent to any provider.
  const rows = await withReadSnapshot(run, 5000, 6000);
  return publishableCategories(rows, catalog, k);
}
