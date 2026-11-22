import { z } from "zod";
import {
  statisticsRequestSchema,
  statisticsResponseSchema,
  type StatisticsRequest,
} from "../../../src/contracts/statistics.ts";
import {
  errorResponseSchema,
  metricValueSchema,
} from "../../../src/contracts/common.ts";
import { db } from "../../../src/db/db.ts";
import {
  DEPARTMENTS,
  EDUCATION,
  OCCUPATIONS,
  GOALS,
  DEPARTMENT_ID_TO_DB,
  DB_TO_DEPARTMENT_ID,
  EDUCATION_ID_TO_DB,
  DB_TO_EDUCATION_ID,
  OCCUPATION_ID_TO_DB,
  DB_TO_OCCUPATION_ID,
  GOAL_ID_TO_DB,
  DB_TO_GOAL_ID,
} from "../../../src/lib/catalog-data.ts";

type MetricValue = z.infer<typeof metricValueSchema>;

function toTemplateStrings(sqlWithPlaceholders: string): TemplateStringsArray {
  const parts = sqlWithPlaceholders.split("__PARAM__");
  return Object.assign([...parts], { raw: parts as readonly string[] }) as unknown as TemplateStringsArray;
}

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "INVALID_JSON",
          message: "El cuerpo de la solicitud no es un JSON válido.",
        },
        requestId,
      }),
      { status: 400 }
    );
  }

  const parsed = statisticsRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
      acc[issue.path.join(".")] = issue.message;
      return acc;
    }, {});

    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "VALIDATION_FAILED",
          message: "La solicitud no cumple con los contratos de validación de estadísticas.",
          fields: errorDetails,
        },
        requestId,
      }),
      { status: 400 }
    );
  }

  const request: StatisticsRequest = parsed.data;
  const filters = request.filters ?? {};

  // Build WHERE conditions
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  if (filters.departmentIds && filters.departmentIds.length > 0) {
    const dbNames = filters.departmentIds
      .map((id) => DEPARTMENT_ID_TO_DB[id])
      .filter(Boolean);
    if (dbNames.length > 0) {
      const placeholders = dbNames.map((name) => {
        params.push(name);
        return "__PARAM__";
      });
      whereClauses.push(`departamento IN (${placeholders.join(", ")})`);
    }
  }

  if (filters.income) {
    if (filters.income.min !== undefined) {
      params.push(filters.income.min);
      whereClauses.push(`ingreso_estimado_usd >= __PARAM__`);
    }
    if (filters.income.max !== undefined) {
      params.push(filters.income.max);
      whereClauses.push(`ingreso_estimado_usd <= __PARAM__`);
    }
  }

  if (filters.educationIds && filters.educationIds.length > 0) {
    const dbNames = filters.educationIds
      .map((id) => EDUCATION_ID_TO_DB[id])
      .filter(Boolean);
    if (dbNames.length > 0) {
      const placeholders = dbNames.map((name) => {
        params.push(name);
        return "__PARAM__";
      });
      whereClauses.push(`nivel_educativo IN (${placeholders.join(", ")})`);
    }
  }

  if (filters.occupationIds && filters.occupationIds.length > 0) {
    const dbNames = filters.occupationIds
      .map((id) => OCCUPATION_ID_TO_DB[id])
      .filter(Boolean);
    if (dbNames.length > 0) {
      const placeholders = dbNames.map((name) => {
        params.push(name);
        return "__PARAM__";
      });
      whereClauses.push(`ocupacion IN (${placeholders.join(", ")})`);
    }
  }

  if (filters.goalIds && filters.goalIds.length > 0) {
    const dbNames = filters.goalIds
      .map((id) => GOAL_ID_TO_DB[id])
      .filter(Boolean);
    if (dbNames.length > 0) {
      const placeholders = dbNames.map((name) => {
        params.push(name);
        return "__PARAM__";
      });
      whereClauses.push(`meta_principal IN (${placeholders.join(", ")})`);
    }
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  try {
    let rows: {
      key: string;
      label: string;
      sampleSize: number | null;
      metrics: Record<string, MetricValue>;
    }[] = [];

    let totalCohortSize = 0;

    if (request.groupBy === "department") {
      const sqlQuery = `
        SELECT 
          departamento,
          COUNT(*)::int AS sample_count,
          ROUND(AVG(ingreso_estimado_usd)::numeric, 2)::float AS income_mean,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ingreso_estimado_usd)::numeric, 2)::float AS income_median,
          ROUND((100.0 * COUNT(*) FILTER (WHERE sin_acceso_financiero = true) / NULLIF(COUNT(*), 0))::numeric, 2)::float AS financial_exclusion_pct
        FROM "NemotronSvMuestra"
        ${whereSql}
        GROUP BY departamento
      `;

      const plan = db.raw.sql(toTemplateStrings(sqlQuery), ...params).returnsRow({
        departamento: "pg/text@1",
        sample_count: "pg/int4@1",
        income_mean: "pg/float8@1",
        income_median: "pg/float8@1",
        financial_exclusion_pct: "pg/float8@1",
      }).build();

      const resultMap = new Map<string, {
        sample_count: number;
        income_mean: number | null;
        income_median: number | null;
        financial_exclusion_pct: number | null;
      }>();

      for await (const row of db.query(plan)) {
        totalCohortSize += row.sample_count;
        const deptId = DB_TO_DEPARTMENT_ID[row.departamento];
        if (deptId) {
          resultMap.set(deptId, row);
        }
      }

      // Target department list: either filtered list or all 14 departments
      const targetDepts = filters.departmentIds && filters.departmentIds.length > 0
        ? DEPARTMENTS.filter((d) => filters.departmentIds?.includes(d.id))
        : DEPARTMENTS;

      rows = targetDepts.map((dept) => {
        const stats = resultMap.get(dept.id);
        const count = stats?.sample_count ?? 0;

        const metricsObj: Record<string, MetricValue> = {};

        for (const metric of request.metrics) {
          if (count === 0) {
            metricsObj[metric] = {
              value: null,
              unit: metric === "sample_count" ? "records" : metric === "financial_exclusion_pct" ? "percent" : "usd_estimated",
              validN: 0,
              missingN: 0,
              suppressed: false,
              reason: "empty",
            };
          } else if (count < 5) {
            metricsObj[metric] = {
              value: null,
              unit: metric === "sample_count" ? "records" : metric === "financial_exclusion_pct" ? "percent" : "usd_estimated",
              validN: null,
              missingN: null,
              suppressed: true,
              reason: "insufficient_sample",
            };
          } else {
            let val: number | null = null;
            if (metric === "sample_count") val = count;
            else if (metric === "income_mean") val = stats?.income_mean ?? null;
            else if (metric === "income_median") val = stats?.income_median ?? null;
            else if (metric === "financial_exclusion_pct") val = stats?.financial_exclusion_pct ?? null;

            metricsObj[metric] = {
              value: val,
              unit: metric === "sample_count" ? "records" : metric === "financial_exclusion_pct" ? "percent" : "usd_estimated",
              validN: count,
              missingN: 0,
              suppressed: false,
              reason: null,
            };
          }
        }

        return {
          key: dept.id,
          label: dept.label,
          sampleSize: count < 5 && count > 0 ? null : count,
          metrics: metricsObj,
        };
      });
    } else {
      // Categorical group by: education, occupation, or goal
      const column =
        request.groupBy === "education"
          ? "nivel_educativo"
          : request.groupBy === "occupation"
          ? "ocupacion"
          : "meta_principal";

      const catalogItems =
        request.groupBy === "education"
          ? EDUCATION
          : request.groupBy === "occupation"
          ? OCCUPATIONS
          : GOALS;

      const idMap =
        request.groupBy === "education"
          ? DB_TO_EDUCATION_ID
          : request.groupBy === "occupation"
          ? DB_TO_OCCUPATION_ID
          : DB_TO_GOAL_ID;

      // 1. Get total matching rows
      const countQuery = `SELECT COUNT(*)::int AS total FROM "NemotronSvMuestra" ${whereSql}`;
      const countPlan = db.raw.sql(toTemplateStrings(countQuery), ...params)
        .returnsRow({ total: "pg/int4@1" })
        .build();

      for await (const row of db.query(countPlan)) {
        totalCohortSize = row.total;
      }

      // 2. Group by column
      const sqlQuery = `
        SELECT 
          ${column} AS category,
          COUNT(*)::int AS category_count
        FROM "NemotronSvMuestra"
        ${whereSql}
        GROUP BY ${column}
      `;

      const plan = db.raw.sql(toTemplateStrings(sqlQuery), ...params)
        .returnsRow({
          category: "pg/text@1",
          category_count: "pg/int4@1",
        })
        .build();

      const resultMap = new Map<string, number>();
      for await (const row of db.query(plan)) {
        const catId = idMap[row.category];
        if (catId) {
          resultMap.set(catId, row.category_count);
        }
      }

      rows = catalogItems.map((item) => {
        const count = resultMap.get(item.id) ?? 0;
        const pct = totalCohortSize > 0 ? Math.round((10000 * count) / totalCohortSize) / 100 : 0;

        const metricsObj: Record<string, MetricValue> = {};

        for (const metric of request.metrics) {
          if (totalCohortSize === 0) {
            metricsObj[metric] = {
              value: null,
              unit: metric === "category_pct" ? "percent" : "records",
              validN: 0,
              missingN: 0,
              suppressed: false,
              reason: "empty",
            };
          } else if (count > 0 && count < 5) {
            metricsObj[metric] = {
              value: null,
              unit: metric === "category_pct" ? "percent" : "records",
              validN: null,
              missingN: null,
              suppressed: true,
              reason: "insufficient_sample",
            };
          } else {
            metricsObj[metric] = {
              value: metric === "category_pct" ? pct : count,
              unit: metric === "category_pct" ? "percent" : "records",
              validN: totalCohortSize,
              missingN: 0,
              suppressed: false,
              reason: null,
            };
          }
        }

        return {
          key: item.id,
          label: item.label,
          sampleSize: count > 0 && count < 5 ? null : count,
          metrics: metricsObj,
        };
      });
    }

    const responsePayload = {
      data: {
        groupBy: request.groupBy,
        rows,
      },
      meta: {
        requestId,
        datasetId: "sv-nemotron",
        datasetVersion: "20261121",
        generatedAt: new Date().toISOString(),
        appliedFilters: filters,
        sampleSize: totalCohortSize,
        warnings: [
          {
            code: "NON_REPRESENTATIVE_SAMPLE",
            message: "Datos de muestra sintética; no necesariamente representativos de El Salvador.",
          },
        ],
      },
    };

    const validated = statisticsResponseSchema.parse(responsePayload);
    return Response.json(validated, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Statistics error:", error);
    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "DATABASE_ERROR",
          message: "Ocurrió un error al procesar las estadísticas en la base de datos.",
        },
        requestId,
      }),
      { status: 500 }
    );
  }
}
