import type { GroupBy, Filters } from "../../contracts/common.ts";
import postgres from "@prisma/orm-postgres/runtime";
import { contract, db } from "../db.ts";
import type { AuditedCatalog } from "../../data/catalog.ts";
import { resolveCategoryFilter } from "../../data/catalog.ts";
import type { AggregateGroup } from "../../server/statistics.ts";
import { throwIfStatisticsBudgetExceeded } from "../../server/statistics-budget.ts";

const textCodec = { codecId: "pg/text@1" } as const;
const numberCodec = { codecId: "pg/float8@1" } as const;

type TransactionCallback = Parameters<typeof db.transaction>[0];
export type ReadSnapshotTransaction = Parameters<TransactionCallback>[0];
type QueryClient = Pick<typeof db, "raw" | "query">;

// Separate client is required: a query through `db` inside db.transaction is enlisted in that
// transaction and cannot cancel its currently-running statement. Cancellation is best effort;
// statement_timeout remains the server-side backstop.
const cancellationDb = postgres({
  contract,
  url: process.env["DATABASE_URL"]!,
  poolOptions: { connectionTimeoutMillis: 1000, idleTimeoutMillis: 1000 },
});

export const closeStatisticsCancellationClient = () => cancellationDb.close();

export async function withReadSnapshot<T>(
  callback: (tx: ReadSnapshotTransaction) => Promise<T>,
  statementTimeoutMs = 5000,
  transactionTimeoutMs = statementTimeoutMs + 1000,
  budget?: { signal: AbortSignal; deadline: number },
): Promise<T> {
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  const remainingMs = () => budget ? Math.max(1, budget.deadline - Date.now()) : statementTimeoutMs;
  try {
    return await db.transaction(async (tx) => {
      if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
      await tx.execute(
        tx.raw.sql`SET TRANSACTION READ ONLY`.affectedCount().build(),
      );
      if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
      const timeout = tx.raw.sql`SELECT set_config('statement_timeout', ${String(Math.min(statementTimeoutMs, remainingMs()))}, true)`
        .returnsRow({ set_config: textCodec }).build();
      await tx.query(timeout);
      if (!budget) return callback(tx);

      const backend = await tx.query(
        tx.raw.sql`SELECT pg_backend_pid()::text AS pid`.returnsRow({ pid: textCodec }).build(),
      );
      const pid = Number(backend[0]?.pid);
      if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Unable to identify PostgreSQL backend");
      let cancellation: Promise<void> | undefined;
      const cancelBackend = () => {
        // PostgreSQL lets a role cancel its own sessions; cancelling others needs pg_signal_backend
        // (or superuser). If the deployment role lacks permission, statement_timeout is the fallback.
        const cancel = cancellationDb.raw.sql`SELECT pg_cancel_backend(${pid}::integer)::text AS cancelled`
          .returnsRow({ cancelled: textCodec }).build();
        cancellation = (async () => { await cancellationDb.query(cancel); })().catch(() => {});
      };
      budget.signal.addEventListener("abort", cancelBackend, { once: true });
      try {
        throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
        const result = await callback(tx);
        throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
        return result;
      } finally {
        budget.signal.removeEventListener("abort", cancelBackend);
        await cancellation;
      }
    }, {
      isolationLevel: "RepeatableRead",
      timeout: budget ? Math.max(1, Math.min(transactionTimeoutMs, budget.deadline - Date.now())) : transactionTimeoutMs,
    });
  } catch (error) {
    if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
    throw error;
  }
}

export async function queryHealth() {
  return withReadSnapshot(
    async (tx) => await tx.orm.public.NemotronSvMuestra.select("id").limit(1).all(),
    1000,
  );
}

export async function queryStatistics(
  catalog: AuditedCatalog,
  groupBy: GroupBy,
  filters: Filters,
  tx?: ReadSnapshotTransaction,
): Promise<AggregateGroup[]> {
  if (!tx) return withReadSnapshot((snapshot) => queryStatistics(catalog, groupBy, filters, snapshot));
  return queryStatisticsOn(tx, catalog, groupBy, filters);
}

export async function queryStatisticsOn(
  tx: ReadSnapshotTransaction,
  catalog: AuditedCatalog,
  groupBy: GroupBy,
  filters: Filters,
  groupByDepartment = true,
  budget?: { signal: AbortSignal; deadline: number },
): Promise<AggregateGroup[]> {
  const selectedDepartments = new Set<string>(filters.departmentIds ?? []);
  const departmentValues = filters.departmentIds
    ? catalog.departments.filter((d) => selectedDepartments.has(d.id)).flatMap((d) => d.sqlValues)
    : [];
  const departmentNames = catalog.departments.flatMap((d) => d.sqlValues);
  const departmentIds = catalog.departments.flatMap((d) => d.sqlValues.map(() => d.id));
  const educationValues = resolveCategoryFilter(catalog.education, filters.educationIds);
  const occupationValues = resolveCategoryFilter(catalog.occupations, filters.occupationIds);
  const goalValues = resolveCategoryFilter(catalog.goals, filters.goalIds);
  const minIncome = filters.income?.min ?? null;
  const maxIncome = filters.income?.max ?? null;
  const hasMinIncome = minIncome !== null;
  const hasMaxIncome = maxIncome !== null;
  const incomeRange = hasMinIncome || hasMaxIncome;

  const client = tx as QueryClient;
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  const sqlForGroup = (group: GroupBy) => {
    if (group === "department") {
      return client.raw.sql`
        SELECT CASE WHEN ${groupByDepartment}::boolean
          THEN COALESCE(mapping.department_id, '__unmapped__') ELSE '__all__' END AS key,
          COUNT(*)::float8 AS n,
          COUNT(sample.ingreso_estimado_usd) FILTER (WHERE sample.ingreso_estimado_usd >= 0 AND sample.ingreso_estimado_usd NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8))::float8 AS income_valid_n,
          AVG(sample.ingreso_estimado_usd) FILTER (WHERE sample.ingreso_estimado_usd >= 0 AND sample.ingreso_estimado_usd NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)) AS income_mean,
          percentile_cont(0.5) WITHIN GROUP (ORDER BY sample.ingreso_estimado_usd)
            FILTER (WHERE sample.ingreso_estimado_usd >= 0 AND sample.ingreso_estimado_usd NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)) AS income_median,
          COUNT(sin_acceso_financiero)::float8 AS finance_valid_n,
          COUNT(*) FILTER (WHERE sin_acceso_financiero IS TRUE)::float8 AS finance_excluded_n
        FROM public."NemotronSvMuestra" AS sample
        LEFT JOIN (
          SELECT names.value AS department_name, ids.value AS department_id
          FROM jsonb_array_elements_text(${JSON.stringify(departmentNames)}::jsonb) WITH ORDINALITY AS names(value, ord)
          JOIN jsonb_array_elements_text(${JSON.stringify(departmentIds)}::jsonb) WITH ORDINALITY AS ids(value, ord) USING (ord)
        ) AS mapping ON sample.departamento = mapping.department_name
        WHERE (jsonb_array_length(${JSON.stringify(departmentValues)}::jsonb) = 0 OR sample.departamento IN
          (SELECT jsonb_array_elements_text(${JSON.stringify(departmentValues)}::jsonb)))
          AND (NOT ${incomeRange}::boolean OR (
            sample.ingreso_estimado_usd >= 0 AND
            sample.ingreso_estimado_usd NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
            AND (NOT ${hasMinIncome}::boolean OR sample.ingreso_estimado_usd >= ${minIncome ?? 0}::float8)
            AND (NOT ${hasMaxIncome}::boolean OR sample.ingreso_estimado_usd <= ${maxIncome ?? 0}::float8)
          ))
          AND (NOT ${educationValues.active}::boolean OR
            sample.nivel_educativo IN (SELECT jsonb_array_elements_text(${JSON.stringify(educationValues.values)}::jsonb)) OR
            (${educationValues.includesMissing}::boolean AND (sample.nivel_educativo IS NULL OR BTRIM(sample.nivel_educativo) = '')))
          AND (NOT ${occupationValues.active}::boolean OR
            sample.ocupacion IN (SELECT jsonb_array_elements_text(${JSON.stringify(occupationValues.values)}::jsonb)) OR
            (${occupationValues.includesMissing}::boolean AND (sample.ocupacion IS NULL OR BTRIM(sample.ocupacion) = '')))
          AND (NOT ${goalValues.active}::boolean OR
            sample.meta_principal IN (SELECT jsonb_array_elements_text(${JSON.stringify(goalValues.values)}::jsonb)) OR
            (${goalValues.includesMissing}::boolean AND (sample.meta_principal IS NULL OR BTRIM(sample.meta_principal) = '')))
        GROUP BY 1
      `.returnsRow({
        key: textCodec, n: numberCodec, income_valid_n: numberCodec,
        income_mean: numberCodec, income_median: numberCodec,
        finance_valid_n: numberCodec, finance_excluded_n: numberCodec,
      }).build();
    }
    return client.raw.sql`
      SELECT CASE
          WHEN CASE ${group}
            WHEN 'education' THEN nivel_educativo
            WHEN 'occupation' THEN ocupacion
            ELSE meta_principal
          END IS NULL OR BTRIM(CASE ${group}
            WHEN 'education' THEN nivel_educativo
            WHEN 'occupation' THEN ocupacion
            ELSE meta_principal
          END) = '' THEN '__missing__'
          ELSE 'v:' || CASE ${group}
            WHEN 'education' THEN nivel_educativo
            WHEN 'occupation' THEN ocupacion
            ELSE meta_principal
          END
        END AS key,
        COUNT(*)::float8 AS n, 0::float8 AS income_valid_n,
        NULL::float8 AS income_mean, NULL::float8 AS income_median,
        0::float8 AS finance_valid_n, 0::float8 AS finance_excluded_n
      FROM public."NemotronSvMuestra"
      WHERE (jsonb_array_length(${JSON.stringify(departmentValues)}::jsonb) = 0 OR departamento IN (SELECT jsonb_array_elements_text(${JSON.stringify(departmentValues)}::jsonb)))
        AND (NOT ${incomeRange}::boolean OR (
          ingreso_estimado_usd >= 0 AND
          ingreso_estimado_usd NOT IN ('NaN'::float8, 'Infinity'::float8, '-Infinity'::float8)
          AND (NOT ${hasMinIncome}::boolean OR ingreso_estimado_usd >= ${minIncome ?? 0}::float8)
          AND (NOT ${hasMaxIncome}::boolean OR ingreso_estimado_usd <= ${maxIncome ?? 0}::float8)
        ))
        AND (NOT ${educationValues.active}::boolean OR
          nivel_educativo IN (SELECT jsonb_array_elements_text(${JSON.stringify(educationValues.values)}::jsonb)) OR
          (${educationValues.includesMissing}::boolean AND (nivel_educativo IS NULL OR BTRIM(nivel_educativo) = '')))
        AND (NOT ${occupationValues.active}::boolean OR
          ocupacion IN (SELECT jsonb_array_elements_text(${JSON.stringify(occupationValues.values)}::jsonb)) OR
          (${occupationValues.includesMissing}::boolean AND (ocupacion IS NULL OR BTRIM(ocupacion) = '')))
        AND (NOT ${goalValues.active}::boolean OR
          meta_principal IN (SELECT jsonb_array_elements_text(${JSON.stringify(goalValues.values)}::jsonb)) OR
          (${goalValues.includesMissing}::boolean AND (meta_principal IS NULL OR BTRIM(meta_principal) = '')))
      GROUP BY 1
    `.returnsRow({
      key: textCodec, n: numberCodec, income_valid_n: numberCodec,
      income_mean: numberCodec, income_median: numberCodec,
      finance_valid_n: numberCodec, finance_excluded_n: numberCodec,
    }).build();
  };

  const plan = sqlForGroup(groupBy);
  if (budget) throwIfStatisticsBudgetExceeded(budget.signal, budget.deadline);
  const rows = await tx.query(plan);
  return rows.map((row) => ({
    key: row.key,
    label: row.key,
    n: row.n,
    incomeValidN: row.income_valid_n,
    incomeMean: row.income_mean,
    incomeMedian: row.income_median,
    financeValidN: row.finance_valid_n,
    financeExcludedN: row.finance_excluded_n,
  }));
}
