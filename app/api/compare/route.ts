import { z } from "zod";
import {
  compareRequestSchema,
  compareResponseSchema,
  type CompareRequest,
} from "../../../src/contracts/compare.ts";
import {
  errorResponseSchema,
  metricValueSchema,
  type MetricId,
  type DepartmentId,
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

  const parsed = compareRequestSchema.safeParse(body);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues.reduce<Record<string, string>>((acc, issue) => {
      acc[issue.path.join(".")] = issue.message;
      return acc;
    }, {});

    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "VALIDATION_FAILED",
          message: "La solicitud no cumple con los contratos de validación de comparación.",
          fields: errorDetails,
        },
        requestId,
      }),
      { status: 400 }
    );
  }

  const request: CompareRequest = parsed.data;
  const filters = request.filters ?? {};

  // Build WHERE conditions
  const whereClauses: string[] = [];
  const params: (string | number)[] = [];

  // 1. Territorial filter: restricted to requested departmentIds
  const deptDbNames = request.departmentIds
    .map((id) => DEPARTMENT_ID_TO_DB[id])
    .filter(Boolean);

  if (deptDbNames.length > 0) {
    const placeholders = deptDbNames.map((name) => {
      params.push(name);
      return "__PARAM__";
    });
    whereClauses.push(`departamento IN (${placeholders.join(", ")})`);
  }

  // 2. Cross-filters
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
    // 1. Calculate department-level metrics
    const deptStatsMap = new Map<DepartmentId, {
      sample_count: number;
      income_mean: number | null;
      income_median: number | null;
      financial_exclusion_pct: number | null;
    }>();

    let totalSelectedCohort = 0;

    const deptSqlQuery = `
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

    const deptPlan = db.raw.sql(toTemplateStrings(deptSqlQuery), ...params).returnsRow({
      departamento: "pg/text@1",
      sample_count: "pg/int4@1",
      income_mean: "pg/float8@1",
      income_median: "pg/float8@1",
      financial_exclusion_pct: "pg/float8@1",
    }).build();

    for await (const row of db.query(deptPlan)) {
      const deptId = DB_TO_DEPARTMENT_ID[row.departamento];
      if (deptId) {
        deptStatsMap.set(deptId, row);
        totalSelectedCohort += row.sample_count;
      }
    }

    // 2. Calculate breakdowns if requested
    const educationBreakdownMap = new Map<string, number>(); // "deptId:catId" -> count
    const occupationBreakdownMap = new Map<string, number>();
    const goalBreakdownMap = new Map<string, number>();

    for (const breakdown of request.breakdowns) {
      const col = breakdown === "education"
        ? "nivel_educativo"
        : breakdown === "occupation"
        ? "ocupacion"
        : "meta_principal";

      const targetMap = breakdown === "education"
        ? educationBreakdownMap
        : breakdown === "occupation"
        ? occupationBreakdownMap
        : goalBreakdownMap;

      const idMap = breakdown === "education"
        ? DB_TO_EDUCATION_ID
        : breakdown === "occupation"
        ? DB_TO_OCCUPATION_ID
        : DB_TO_GOAL_ID;

      const breakdownSqlQuery = `
        SELECT 
          departamento,
          ${col} AS category,
          COUNT(*)::int AS category_count
        FROM "NemotronSvMuestra"
        ${whereSql}
        GROUP BY departamento, ${col}
      `;

      const breakdownPlan = db.raw.sql(toTemplateStrings(breakdownSqlQuery), ...params).returnsRow({
        departamento: "pg/text@1",
        category: "pg/text@1",
        category_count: "pg/int4@1",
      }).build();

      for await (const row of db.query(breakdownPlan)) {
        const deptId = DB_TO_DEPARTMENT_ID[row.departamento];
        const catId = idMap[row.category];
        if (deptId && catId) {
          targetMap.set(`${deptId}:${catId}`, row.category_count);
        }
      }
    }

    // 3. Extract metrics per department
    const deptMetricsMap = new Map<DepartmentId, Partial<Record<MetricId, MetricValue>>>();

    for (const deptId of request.departmentIds) {
      const stats = deptStatsMap.get(deptId);
      const count = stats?.sample_count ?? 0;
      const metricsObj: Partial<Record<MetricId, MetricValue>> = {};

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

      deptMetricsMap.set(deptId, metricsObj);
    }

    // 4. Reference department metrics
    const refMetrics: Partial<Record<MetricId, MetricValue>> = deptMetricsMap.get(request.referenceDepartmentId) ?? {};

    // 5. Construct department response array with differences and breakdowns
    const departmentsResponse = request.departmentIds.map((deptId) => {
      const deptMeta = DEPARTMENTS.find((d) => d.id === deptId);
      const label = deptMeta?.label ?? deptId;
      const stats = deptStatsMap.get(deptId);
      const sampleSize = stats?.sample_count ?? 0;
      const deptMetrics: Partial<Record<MetricId, MetricValue>> = deptMetricsMap.get(deptId) ?? {};

      // Calculate differences against reference
      const differences = request.metrics.map((metricId) => {
        const deptVal = deptMetrics[metricId]?.value;
        const refVal = refMetrics[metricId]?.value;

        let diffValue: number | null = null;
        if (
          deptVal !== null &&
          deptVal !== undefined &&
          refVal !== null &&
          refVal !== undefined
        ) {
          if (deptId === request.referenceDepartmentId) {
            diffValue = 0;
          } else if (metricId === "sample_count") {
            diffValue = Math.round(deptVal - refVal);
          } else {
            diffValue = Math.round((deptVal - refVal) * 100) / 100;
          }
        }

        const unit: "records" | "usd_estimated" | "percentage_points" =
          metricId === "sample_count"
            ? "records"
            : metricId === "financial_exclusion_pct"
            ? "percentage_points"
            : "usd_estimated";

        return {
          metricId,
          value: diffValue,
          unit,
        };
      });

      // Construct requested breakdowns
      const breakdownsObj: Record<string, unknown> = {};

      for (const breakdown of request.breakdowns) {
        const catalogItems =
          breakdown === "education"
            ? EDUCATION
            : breakdown === "occupation"
            ? OCCUPATIONS
            : GOALS;

        const targetMap =
          breakdown === "education"
            ? educationBreakdownMap
            : breakdown === "occupation"
            ? occupationBreakdownMap
            : goalBreakdownMap;

        const breakdownRows = catalogItems.map((item) => {
          const count = targetMap.get(`${deptId}:${item.id}`) ?? 0;
          const pct = sampleSize > 0 ? Math.round((10000 * count) / sampleSize) / 100 : 0;

          const metrics: Record<string, MetricValue> = {};

          if (sampleSize === 0) {
            metrics["category_count"] = {
              value: null,
              unit: "records",
              validN: 0,
              missingN: 0,
              suppressed: false,
              reason: "empty",
            };
            metrics["category_pct"] = {
              value: null,
              unit: "percent",
              validN: 0,
              missingN: 0,
              suppressed: false,
              reason: "empty",
            };
          } else if (count > 0 && count < 5) {
            metrics["category_count"] = {
              value: null,
              unit: "records",
              validN: null,
              missingN: null,
              suppressed: true,
              reason: "insufficient_sample",
            };
            metrics["category_pct"] = {
              value: null,
              unit: "percent",
              validN: null,
              missingN: null,
              suppressed: true,
              reason: "insufficient_sample",
            };
          } else {
            metrics["category_count"] = {
              value: count,
              unit: "records",
              validN: sampleSize,
              missingN: 0,
              suppressed: false,
              reason: null,
            };
            metrics["category_pct"] = {
              value: pct,
              unit: "percent",
              validN: sampleSize,
              missingN: 0,
              suppressed: false,
              reason: null,
            };
          }

          return {
            key: item.id,
            label: item.label,
            sampleSize: count > 0 && count < 5 ? null : count,
            metrics,
          };
        });

        breakdownsObj[breakdown] = breakdownRows;
      }

      return {
        id: deptId,
        label,
        sampleSize: sampleSize > 0 && sampleSize < 5 ? null : sampleSize,
        metrics: deptMetrics,
        differences,
        breakdowns: breakdownsObj,
      };
    });

    const responsePayload = {
      data: {
        referenceDepartmentId: request.referenceDepartmentId,
        departments: departmentsResponse,
      },
      meta: {
        requestId,
        datasetId: "sv-nemotron",
        datasetVersion: "20261121",
        generatedAt: new Date().toISOString(),
        appliedFilters: {
          departmentIds: request.departmentIds,
          ...filters,
        },
        sampleSize: totalSelectedCohort,
        warnings: [
          {
            code: "NON_REPRESENTATIVE_SAMPLE",
            message: "Datos de muestra sintética; no necesariamente representativos de El Salvador.",
          },
        ],
      },
    };

    const validated = compareResponseSchema.parse(responsePayload);
    return Response.json(validated, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Compare error:", error);
    return Response.json(
      errorResponseSchema.parse({
        error: {
          code: "INTERNAL_ERROR",
          message: "Ocurrió un error inesperado al procesar la comparación departamental.",
        },
        requestId,
      }),
      { status: 500 }
    );
  }
}
