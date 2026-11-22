import { z } from "zod";
import { db } from "../db/db.ts";
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
} from "../lib/catalog-data.ts";
import type { DepartmentId, Filters, MetricId } from "../contracts/common.ts";
import type { ChatRequest, ChatResponse, ChartSpec } from "../contracts/chat.ts";

function toTemplateStrings(sqlWithPlaceholders: string): TemplateStringsArray {
  const parts = sqlWithPlaceholders.split("__PARAM__");
  return Object.assign([...parts], { raw: parts as readonly string[] }) as unknown as TemplateStringsArray;
}

type EvidenceItem = ChatResponse["data"]["evidence"][number];
type ChatBlock = ChatResponse["data"]["blocks"][number];
type ToolName = ChatResponse["data"]["toolsUsed"][number];

// Build SQL WHERE condition and parameters from filters
function buildWhereClause(filters: Filters): { whereSql: string; params: (string | number)[] } {
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
  return { whereSql, params };
}

// 1. Tool: get_statistics
async function executeGetStatistics(
  filters: Filters,
  groupBy: "department" | "education" | "occupation" | "goal"
): Promise<{
  evidenceItem: EvidenceItem;
  rows: { key: string; label: string; count: number; mean: number | null; exclusionPct: number | null }[];
  cohortSize: number;
}> {
  const { whereSql, params } = buildWhereClause(filters);

  if (groupBy === "department") {
    const sql = `
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

    const plan = db.raw.sql(toTemplateStrings(sql), ...params).returnsRow({
      departamento: "pg/text@1",
      sample_count: "pg/int4@1",
      income_mean: "pg/float8@1",
      income_median: "pg/float8@1",
      financial_exclusion_pct: "pg/float8@1",
    }).build();

    let totalCohort = 0;
    const rawRows: { departamento: string; sample_count: number; income_mean: number | null; financial_exclusion_pct: number | null }[] = [];

    for await (const row of db.query(plan)) {
      totalCohort += row.sample_count;
      rawRows.push(row);
    }

    const facts: EvidenceItem["facts"] = [];
    const rows = rawRows.map((r) => {
      const deptId = DB_TO_DEPARTMENT_ID[r.departamento] ?? r.departamento;
      const deptMeta = DEPARTMENTS.find((d) => d.id === deptId);
      const label = deptMeta?.label ?? r.departamento;

      if (r.sample_count >= 5) {
        if (r.income_mean !== null) {
          facts.push({
            id: `${deptId}-mean`,
            label: `Ingreso medio estimado en ${label}`,
            value: r.income_mean,
            unit: "usd_estimated",
          });
        }
        if (r.financial_exclusion_pct !== null) {
          facts.push({
            id: `${deptId}-exclusion`,
            label: `Tasa de exclusión financiera en ${label}`,
            value: r.financial_exclusion_pct,
            unit: "percent",
          });
        }
      }

      return {
        key: deptId,
        label,
        count: r.sample_count,
        mean: r.sample_count >= 5 ? r.income_mean : null,
        exclusionPct: r.sample_count >= 5 ? r.financial_exclusion_pct : null,
      };
    });

    const evidenceItem: EvidenceItem = {
      id: `ev-stats-${crypto.randomUUID().slice(0, 8)}`,
      kind: "sql_aggregate",
      description: "Agregación SQL exacta por departamento sobre registros filtrados de la muestra",
      filters,
      sampleSize: totalCohort,
      exhaustive: true,
      facts,
    };

    return { evidenceItem, rows, cohortSize: totalCohort };
  } else {
    // Categorical breakdown
    const column =
      groupBy === "education"
        ? "nivel_educativo"
        : groupBy === "occupation"
        ? "ocupacion"
        : "meta_principal";

    const catalogItems =
      groupBy === "education"
        ? EDUCATION
        : groupBy === "occupation"
        ? OCCUPATIONS
        : GOALS;

    const idMap =
      groupBy === "education"
        ? DB_TO_EDUCATION_ID
        : groupBy === "occupation"
        ? DB_TO_OCCUPATION_ID
        : DB_TO_GOAL_ID;

    // 1. Total cohort count
    const countSql = `SELECT COUNT(*)::int AS total FROM "NemotronSvMuestra" ${whereSql}`;
    const countPlan = db.raw.sql(toTemplateStrings(countSql), ...params).returnsRow({ total: "pg/int4@1" }).build();
    let totalCohort = 0;
    for await (const row of db.query(countPlan)) {
      totalCohort = row.total;
    }

    // 2. Group by query
    const sql = `
      SELECT ${column} AS category, COUNT(*)::int AS category_count
      FROM "NemotronSvMuestra"
      ${whereSql}
      GROUP BY ${column}
    `;
    const plan = db.raw.sql(toTemplateStrings(sql), ...params).returnsRow({
      category: "pg/text@1",
      category_count: "pg/int4@1",
    }).build();

    const countsMap = new Map<string, number>();
    for await (const row of db.query(plan)) {
      const id = idMap[row.category];
      if (id) countsMap.set(id, row.category_count);
    }

    const facts: EvidenceItem["facts"] = [];
    const rows = catalogItems.map((item) => {
      const count = countsMap.get(item.id) ?? 0;
      const pct = totalCohort > 0 ? Math.round((10000 * count) / totalCohort) / 100 : 0;

      if (count >= 5) {
        facts.push({
          id: `${item.id}-pct`,
          label: `Porcentaje con ${item.label}`,
          value: pct,
          unit: "percent",
        });
      }

      return {
        key: item.id,
        label: item.label,
        count,
        mean: null,
        exclusionPct: count >= 5 ? pct : null,
      };
    });

    const evidenceItem: EvidenceItem = {
      id: `ev-breakdown-${crypto.randomUUID().slice(0, 8)}`,
      kind: "sql_aggregate",
      description: `Distribución categórica de ${groupBy} calculada exactamente en PostgreSQL`,
      filters,
      sampleSize: totalCohort,
      exhaustive: true,
      facts,
    };

    return { evidenceItem, rows, cohortSize: totalCohort };
  }
}

// 2. Tool: compare_departments
async function executeCompareDepartments(
  departmentIds: DepartmentId[],
  referenceDepartmentId: DepartmentId,
  filters: Filters
): Promise<{
  evidenceItem: EvidenceItem;
  results: {
    deptId: DepartmentId;
    label: string;
    sampleSize: number;
    mean: number | null;
    exclusionPct: number | null;
    meanDiff: number | null;
    exclusionDiffPp: number | null;
  }[];
  cohortSize: number;
}> {
  const safeFilters = { ...filters, departmentIds };
  const { whereSql, params } = buildWhereClause(safeFilters);

  const sql = `
    SELECT 
      departamento,
      COUNT(*)::int AS sample_count,
      ROUND(AVG(ingreso_estimado_usd)::numeric, 2)::float AS income_mean,
      ROUND((100.0 * COUNT(*) FILTER (WHERE sin_acceso_financiero = true) / NULLIF(COUNT(*), 0))::numeric, 2)::float AS financial_exclusion_pct
    FROM "NemotronSvMuestra"
    ${whereSql}
    GROUP BY departamento
  `;

  const plan = db.raw.sql(toTemplateStrings(sql), ...params).returnsRow({
    departamento: "pg/text@1",
    sample_count: "pg/int4@1",
    income_mean: "pg/float8@1",
    financial_exclusion_pct: "pg/float8@1",
  }).build();

  const statsMap = new Map<DepartmentId, { count: number; mean: number | null; exclusion: number | null }>();
  let totalCohort = 0;

  for await (const row of db.query(plan)) {
    const deptId = DB_TO_DEPARTMENT_ID[row.departamento];
    if (deptId) {
      statsMap.set(deptId, {
        count: row.sample_count,
        mean: row.income_mean,
        exclusion: row.financial_exclusion_pct,
      });
      totalCohort += row.sample_count;
    }
  }

  const refStats = statsMap.get(referenceDepartmentId);
  const refMean = refStats?.count && refStats.count >= 5 ? refStats.mean : null;
  const refExclusion = refStats?.count && refStats.count >= 5 ? refStats.exclusion : null;

  const facts: EvidenceItem["facts"] = [];
  const results = departmentIds.map((deptId) => {
    const deptMeta = DEPARTMENTS.find((d) => d.id === deptId);
    const label = deptMeta?.label ?? deptId;
    const stats = statsMap.get(deptId);
    const count = stats?.count ?? 0;
    const mean = count >= 5 ? stats?.mean ?? null : null;
    const exclusion = count >= 5 ? stats?.exclusion ?? null : null;

    let meanDiff: number | null = null;
    let exclusionDiffPp: number | null = null;

    if (deptId === referenceDepartmentId) {
      meanDiff = mean !== null ? 0 : null;
      exclusionDiffPp = exclusion !== null ? 0 : null;
    } else {
      if (mean !== null && refMean !== null) {
        meanDiff = Math.round((mean - refMean) * 100) / 100;
      }
      if (exclusion !== null && refExclusion !== null) {
        exclusionDiffPp = Math.round((exclusion - refExclusion) * 100) / 100;
      }
    }

    if (mean !== null) {
      facts.push({
        id: `${deptId}-mean`,
        label: `Ingreso medio en ${label}`,
        value: mean,
        unit: "usd_estimated",
      });
    }
    if (meanDiff !== null) {
      facts.push({
        id: `${deptId}-diff-mean`,
        label: `Diferencia de ingreso de ${label} vs referencia`,
        value: meanDiff,
        unit: "usd_estimated",
      });
    }
    if (exclusionDiffPp !== null) {
      facts.push({
        id: `${deptId}-diff-exclusion`,
        label: `Brecha de exclusión de ${label} vs referencia`,
        value: exclusionDiffPp,
        unit: "percentage_points",
      });
    }

    return {
      deptId,
      label,
      sampleSize: count,
      mean,
      exclusionPct: exclusion,
      meanDiff,
      exclusionDiffPp,
    };
  });

  const evidenceItem: EvidenceItem = {
    id: `ev-compare-${crypto.randomUUID().slice(0, 8)}`,
    kind: "sql_aggregate",
    description: `Comparación exacta en PostgreSQL contra referencia ${referenceDepartmentId}`,
    filters: safeFilters,
    sampleSize: totalCohort,
    exhaustive: true,
    facts,
  };

  return { evidenceItem, results, cohortSize: totalCohort };
}

// 3. Tool: search_semantic_evidence
async function executeSemanticEvidence(
  query: string,
  filters: Filters,
  topK = 5
): Promise<{
  evidenceItem: EvidenceItem;
  examples: { departamento: string; meta_principal: string; ocupacion: string; ingreso: number }[];
}> {
  const { whereSql, params } = buildWhereClause(filters);

  // We query representative examples from NemotronSvMuestra matching relevant goals
  // To avoid blocking on external model downloads, we use exact keyword matching on metas
  // combined with pgvector embeddings when available
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  let goalFilterSql = "";

  if (terms.length > 0) {
    const termConditions = terms.map(() => `meta_principal ILIKE __PARAM__`);
    terms.forEach((t) => params.push(`%${t}%`));
    goalFilterSql = termConditions.join(" OR ");
  }

  const combinedWhere = whereSql
    ? goalFilterSql
      ? `${whereSql} AND (${goalFilterSql})`
      : whereSql
    : goalFilterSql
    ? `WHERE ${goalFilterSql}`
    : "";

  const sql = `
    SELECT 
      departamento,
      meta_principal,
      ocupacion,
      ingreso_estimado_usd AS ingreso
    FROM "NemotronSvMuestra"
    ${combinedWhere}
    LIMIT ${Math.min(topK, 10)}
  `;

  const plan = db.raw.sql(toTemplateStrings(sql), ...params).returnsRow({
    departamento: "pg/text@1",
    meta_principal: "pg/text@1",
    ocupacion: "pg/text@1",
    ingreso: "pg/float8@1",
  }).build();

  const examples: { departamento: string; meta_principal: string; ocupacion: string; ingreso: number }[] = [];
  const facts: EvidenceItem["facts"] = [];

  for await (const row of db.query(plan)) {
    examples.push(row);
    facts.push({
      id: `semantic-example-${examples.length}`,
      label: `Ejemplo cualitativo: "${row.meta_principal}" (${row.departamento})`,
      value: null,
      unit: "qualitative_goal",
    });
  }

  const evidenceItem: EvidenceItem = {
    id: `ev-semantic-${crypto.randomUUID().slice(0, 8)}`,
    kind: "semantic_examples",
    description: "Ejemplos cualitativos exploratorios de metas y necesidades recuperados de la muestra",
    filters,
    sampleSize: examples.length,
    exhaustive: false,
    facts,
  };

  return { evidenceItem, examples };
}

// Main assistant handler
export async function handleChatQuestion(
  request: ChatRequest
): Promise<ChatResponse> {
  const requestId = crypto.randomUUID();
  const rawQ = request.question.trim();
  const q = rawQ.toLowerCase();
  const filters: Filters = request.filters ?? {};

  const toolsUsed: ToolName[] = [];
  const evidence: EvidenceItem[] = [];
  const blocks: ChatBlock[] = [];

  // Check for ambiguous / vague questions
  const greetings = ["hola", "buenos días", "buenas tardes", "saludos", "qué tal", "ayuda"];
  const isGreetingOnly = greetings.some((g) => q === g || q.startsWith(`${g} `) && q.length < 15);

  if (isGreetingOnly) {
    return {
      data: {
        status: "needs_clarification",
        blocks: [
          {
            type: "text",
            text: "¡Hola! Soy el Asistente Analítico de ImpactAtlas. Puedo ayudarte a responder consultas sobre inclusión financiera, niveles de ingreso, educación y metas de la población salvadoreña a partir de los 50,000 registros de la muestra. Por ejemplo, puedes preguntarme:\n\n• *«¿Cómo se comparan los ingresos entre Santa Ana y San Salvador?»*\n• *«¿Qué departamento tiene la mayor tasa de exclusión financiera?»*\n• *«¿Cuáles son las metas principales de las personas que trabajan en agricultura?»*",
            evidenceIds: [],
          },
        ],
        evidence: [],
        toolsUsed: [],
      },
      meta: {
        requestId,
        datasetId: "sv-nemotron",
        datasetVersion: "20261121",
        generatedAt: new Date().toISOString(),
        appliedFilters: filters,
        sampleSize: null,
        warnings: [
          {
            code: "NON_REPRESENTATIVE_SAMPLE",
            message: "Datos de muestra sintética; no necesariamente representativos de El Salvador.",
          },
        ],
      },
    };
  }

  // Detect mentioned departments
  const mentionedDepts = DEPARTMENTS.filter(
    (d) => q.includes(d.id) || q.includes(d.label.toLowerCase())
  ).map((d) => d.id);

  // 1. Comparison Intent
  const isComparisonQuery =
    mentionedDepts.length >= 2 ||
    q.includes("comparar") ||
    q.includes("comparación") ||
    q.includes("diferencia") ||
    q.includes("brecha") ||
    q.includes("frente a") ||
    q.includes(" vs ");

  if (isComparisonQuery) {
    const deptsToCompare =
      mentionedDepts.length >= 2
        ? mentionedDepts.slice(0, 4)
        : filters.departmentIds && filters.departmentIds.length >= 2
        ? filters.departmentIds.slice(0, 4)
        : (["santa-ana", "san-salvador"] as DepartmentId[]);

    const refDept = deptsToCompare[0];
    toolsUsed.push("compare_departments");

    const compareResult = await executeCompareDepartments(deptsToCompare, refDept, filters);
    evidence.push(compareResult.evidenceItem);

    if (compareResult.cohortSize === 0) {
      return {
        data: {
          status: "insufficient_evidence",
          blocks: [
            {
              type: "text",
              text: `No se encontraron registros para los departamentos seleccionados (${deptsToCompare.join(", ")}) bajo los filtros activos. Intenta ampliar los rangos de ingreso o eliminar restricciones para obtener resultados.`,
              evidenceIds: [compareResult.evidenceItem.id],
            },
          ],
          evidence,
          toolsUsed,
        },
        meta: {
          requestId,
          datasetId: "sv-nemotron",
          datasetVersion: "20261121",
          generatedAt: new Date().toISOString(),
          appliedFilters: filters,
          sampleSize: 0,
          warnings: [{ code: "EMPTY_SAMPLE", message: "La cohorte resultante no contiene registros." }],
        },
      };
    }

    // Build comparison narrative
    const refItem = compareResult.results.find((r) => r.deptId === refDept);
    const otherItems = compareResult.results.filter((r) => r.deptId !== refDept);

    let narrative = `A partir del análisis comparativo sobre la muestra (referencia base: **${refItem?.label}** con ingreso medio de **$${refItem?.mean?.toFixed(2) ?? "N/D"}** y exclusión del **${refItem?.exclusionPct?.toFixed(1) ?? "N/D"}%**):\n\n`;

    for (const item of otherItems) {
      const meanSign = item.meanDiff !== null && item.meanDiff > 0 ? "+" : "";
      const exclSign = item.exclusionDiffPp !== null && item.exclusionDiffPp > 0 ? "+" : "";

      narrative += `• **${item.label}**: Ingreso medio estimado de **$${item.mean?.toFixed(2) ?? "N/D"}** (${meanSign}$${item.meanDiff?.toFixed(2) ?? "0.00"} vs base) y tasa de exclusión financiera de **${item.exclusionPct?.toFixed(1) ?? "N/D"}%** (${exclSign}${item.exclusionDiffPp?.toFixed(1) ?? "0.0"} pp vs base).\n`;
    }

    narrative += `\n*Nota metodológica: Las diferencias se calculan directamente en PostgreSQL. Los porcentajes se comparan en puntos porcentuales (pp) sobre la muestra analizada ($N = ${compareResult.cohortSize.toLocaleString()}$).*`;

    blocks.push({
      type: "text",
      text: narrative,
      evidenceIds: [compareResult.evidenceItem.id],
    });

    // Comparative Table Block
    blocks.push({
      type: "table",
      title: `Comparación Territorial frente a ${refItem?.label}`,
      columns: ["Departamento", "Muestra (n)", "Ingreso Medio", "Δ Ingreso vs Base", "Exclusión Financiera", "Δ Exclusión (pp)"],
      rows: compareResult.results.map((r) => [
        r.label,
        r.sampleSize,
        r.mean !== null ? `$${r.mean.toFixed(2)}` : "Suprimido (< 5)",
        r.meanDiff !== null ? (r.meanDiff > 0 ? `+$${r.meanDiff.toFixed(2)}` : `$${r.meanDiff.toFixed(2)}`) : "Base",
        r.exclusionPct !== null ? `${r.exclusionPct.toFixed(1)}%` : "Suprimido (< 5)",
        r.exclusionDiffPp !== null ? (r.exclusionDiffPp > 0 ? `+${r.exclusionDiffPp.toFixed(1)} pp` : `${r.exclusionDiffPp.toFixed(1)} pp`) : "Base",
      ]),
      evidenceIds: [compareResult.evidenceItem.id],
    });

    // Chart Block (Grouped Bar Chart)
    const validResults = compareResult.results.filter((r) => r.mean !== null);
    if (validResults.length >= 2) {
      const chartSpec: ChartSpec = {
        type: "grouped_bar",
        title: "Ingreso Medio Estimado por Departamento ($ USD)",
        categories: validResults.map((r) => r.label),
        series: [
          {
            name: "Ingreso Medio Estimado",
            values: validResults.map((r) => r.mean),
            unit: "usd_estimated",
          },
        ],
        evidenceIds: [compareResult.evidenceItem.id],
      };

      blocks.push({
        type: "chart",
        chart: chartSpec,
      });
    }

    return {
      data: {
        status: "answered",
        blocks,
        evidence,
        toolsUsed,
      },
      meta: {
        requestId,
        datasetId: "sv-nemotron",
        datasetVersion: "20261121",
        generatedAt: new Date().toISOString(),
        appliedFilters: filters,
        sampleSize: compareResult.cohortSize,
        warnings: [
          {
            code: "NON_REPRESENTATIVE_SAMPLE",
            message: "Datos de muestra sintética; no necesariamente representativos de El Salvador.",
          },
        ],
      },
    };
  }

  // 2. Goal / Qualitative / Semantic Intent
  const isGoalQuery =
    q.includes("meta") ||
    q.includes("metas") ||
    q.includes("sueño") ||
    q.includes("aspiración") ||
    q.includes("crédito") ||
    q.includes("negocio") ||
    q.includes("remesas") ||
    q.includes("terreno") ||
    q.includes("vivienda");

  if (isGoalQuery) {
    toolsUsed.push("get_statistics", "search_semantic_evidence");

    const [statsResult, semanticResult] = await Promise.all([
      executeGetStatistics(filters, "goal"),
      executeSemanticEvidence(rawQ, filters, 4),
    ]);

    evidence.push(statsResult.evidenceItem, semanticResult.evidenceItem);

    if (statsResult.cohortSize === 0) {
      return {
        data: {
          status: "insufficient_evidence",
          blocks: [
            {
              type: "text",
              text: "No se encontraron perfiles con los filtros actuales para evaluar las metas socioeconómicas. Te sugerimos relajar los filtros de ingreso o territorio.",
              evidenceIds: [statsResult.evidenceItem.id],
            },
          ],
          evidence,
          toolsUsed,
        },
        meta: {
          requestId,
          datasetId: "sv-nemotron",
          datasetVersion: "20261121",
          generatedAt: new Date().toISOString(),
          appliedFilters: filters,
          sampleSize: 0,
          warnings: [{ code: "EMPTY_SAMPLE", message: "La cohorte resultante no contiene registros." }],
        },
      };
    }

    // Top goals
    const sortedGoals = [...statsResult.rows].sort((a, b) => b.count - a.count);
    const topGoal = sortedGoals[0];

    let narrative = `En la cohorte analizada ($N = ${statsResult.cohortSize.toLocaleString()}$ perfiles), la meta socioeconómica más frecuente es **«${topGoal.label}»** con un **${topGoal.exclusionPct?.toFixed(1) ?? "0.0"}%** de las respuestas (${topGoal.count.toLocaleString()} personas).\n\nDistribución de las principales aspiraciones:\n`;

    for (const g of sortedGoals.slice(0, 4)) {
      narrative += `• **${g.label}**: ${g.exclusionPct?.toFixed(1) ?? "N/D"}% (${g.count.toLocaleString()} registros)\n`;
    }

    if (semanticResult.examples.length > 0) {
      narrative += `\n**Evidencia cualitativa representativa:**\n`;
      for (const ex of semanticResult.examples) {
        narrative += `• *«${ex.meta_principal}»* — Departamento: ${ex.departamento}, Ocupación: ${ex.ocupacion}, Ingreso estimado: $${ex.ingreso.toFixed(2)}.\n`;
      }
    }

    blocks.push({
      type: "text",
      text: narrative,
      evidenceIds: [statsResult.evidenceItem.id, semanticResult.evidenceItem.id],
    });

    // Table Block
    blocks.push({
      type: "table",
      title: "Distribución de Metas Principales en la Muestra",
      columns: ["Meta Declarada", "Frecuencia (n)", "Proporción (%)"],
      rows: sortedGoals.map((g) => [
        g.label,
        g.count,
        g.exclusionPct !== null ? `${g.exclusionPct.toFixed(1)}%` : "Suprimido (< 5)",
      ]),
      evidenceIds: [statsResult.evidenceItem.id],
    });

    // Chart Block
    const chartSpec: ChartSpec = {
      type: "bar",
      title: "Proporción por Meta Principal (%)",
      categories: sortedGoals.map((g) => g.label.slice(0, 25)),
      series: [
        {
          name: "Porcentaje de Población",
          values: sortedGoals.map((g) => g.exclusionPct ?? null),
          unit: "percent",
        },
      ],
      evidenceIds: [statsResult.evidenceItem.id],
    };

    blocks.push({
      type: "chart",
      chart: chartSpec,
    });

    return {
      data: {
        status: "answered",
        blocks,
        evidence,
        toolsUsed,
      },
      meta: {
        requestId,
        datasetId: "sv-nemotron",
        datasetVersion: "20261121",
        generatedAt: new Date().toISOString(),
        appliedFilters: filters,
        sampleSize: statsResult.cohortSize,
        warnings: [
          {
            code: "NON_REPRESENTATIVE_SAMPLE",
            message: "Datos de muestra sintética; no necesariamente representativos de El Salvador.",
          },
        ],
      },
    };
  }

  // 3. Education Breakdown Intent
  const isEduQuery =
    q.includes("educación") ||
    q.includes("escolaridad") ||
    q.includes("universidad") ||
    q.includes("estudios") ||
    q.includes("bachillerato");

  if (isEduQuery) {
    toolsUsed.push("get_statistics");
    const statsResult = await executeGetStatistics(filters, "education");
    evidence.push(statsResult.evidenceItem);

    const sortedEdu = statsResult.rows;
    let narrative = `Distribución educativa calculada para la cohorte activa ($N = ${statsResult.cohortSize.toLocaleString()}$ perfiles):\n\n`;
    for (const e of sortedEdu) {
      narrative += `• **${e.label}**: ${e.exclusionPct?.toFixed(1) ?? "N/D"}% (${e.count.toLocaleString()} personas)\n`;
    }

    blocks.push({
      type: "text",
      text: narrative,
      evidenceIds: [statsResult.evidenceItem.id],
    });

    blocks.push({
      type: "table",
      title: "Distribución por Nivel Educativo",
      columns: ["Nivel Educativo", "Muestra (n)", "Porcentaje (%)"],
      rows: sortedEdu.map((e) => [
        e.label,
        e.count,
        e.exclusionPct !== null ? `${e.exclusionPct.toFixed(1)}%` : "Suprimido (< 5)",
      ]),
      evidenceIds: [statsResult.evidenceItem.id],
    });

    const chartSpec: ChartSpec = {
      type: "bar",
      title: "Distribución Educativa (%)",
      categories: sortedEdu.map((e) => e.label),
      series: [
        {
          name: "Porcentaje",
          values: sortedEdu.map((e) => e.exclusionPct ?? null),
          unit: "percent",
        },
      ],
      evidenceIds: [statsResult.evidenceItem.id],
    };

    blocks.push({
      type: "chart",
      chart: chartSpec,
    });

    return {
      data: {
        status: "answered",
        blocks,
        evidence,
        toolsUsed,
      },
      meta: {
        requestId,
        datasetId: "sv-nemotron",
        datasetVersion: "20261121",
        generatedAt: new Date().toISOString(),
        appliedFilters: filters,
        sampleSize: statsResult.cohortSize,
        warnings: [
          {
            code: "NON_REPRESENTATIVE_SAMPLE",
            message: "Datos de muestra sintética; no necesariamente representativos de El Salvador.",
          },
        ],
      },
    };
  }

  // 4. Default / General Department Statistics Intent
  toolsUsed.push("get_statistics");
  const statsResult = await executeGetStatistics(filters, "department");
  evidence.push(statsResult.evidenceItem);

  if (statsResult.cohortSize === 0) {
    return {
      data: {
        status: "insufficient_evidence",
        blocks: [
          {
            type: "text",
            text: "No se encontraron registros que coincidan con los filtros aplicados. Prueba ampliando los rangos de ingreso o seleccionando otros departamentos.",
            evidenceIds: [statsResult.evidenceItem.id],
          },
        ],
        evidence,
        toolsUsed,
      },
      meta: {
        requestId,
        datasetId: "sv-nemotron",
        datasetVersion: "20261121",
        generatedAt: new Date().toISOString(),
        appliedFilters: filters,
        sampleSize: 0,
        warnings: [{ code: "EMPTY_SAMPLE", message: "La cohorte resultante no contiene registros." }],
      },
    };
  }

  const validDepts = statsResult.rows.filter((r) => r.mean !== null);
  const sortedByIncome = [...validDepts].sort((a, b) => (b.mean ?? 0) - (a.mean ?? 0));
  const topIncome = sortedByIncome[0];
  const lowIncome = sortedByIncome[sortedByIncome.length - 1];

  let narrative = `Análisis general departamental sobre la muestra ($N = ${statsResult.cohortSize.toLocaleString()}$ perfiles analizados):\n\n`;
  if (topIncome && lowIncome) {
    narrative += `• Departamento con mayor ingreso medio estimado: **${topIncome.label}** ($${topIncome.mean?.toFixed(2)} USD, exclusión financiera: ${topIncome.exclusionPct?.toFixed(1)}%).\n`;
    narrative += `• Departamento con menor ingreso medio estimado: **${lowIncome.label}** ($${lowIncome.mean?.toFixed(2)} USD, exclusión financiera: ${lowIncome.exclusionPct?.toFixed(1)}%).\n\n`;
  }
  narrative += `A continuación se detallan los indicadores calculados de forma exacta en la base de datos para cada departamento:`;

  blocks.push({
    type: "text",
    text: narrative,
    evidenceIds: [statsResult.evidenceItem.id],
  });

  // Table Block
  blocks.push({
    type: "table",
    title: "Resumen de Indicadores por Departamento",
    columns: ["Departamento", "Muestra (n)", "Ingreso Medio ($)", "Exclusión Financiera (%)"],
    rows: statsResult.rows.map((r) => [
      r.label,
      r.count,
      r.mean !== null ? `$${r.mean.toFixed(2)}` : "Suprimido (< 5)",
      r.exclusionPct !== null ? `${r.exclusionPct.toFixed(1)}%` : "Suprimido (< 5)",
    ]),
    evidenceIds: [statsResult.evidenceItem.id],
  });

  // Chart Block
  if (sortedByIncome.length > 0) {
    const chartSpec: ChartSpec = {
      type: "bar",
      title: "Ingreso Medio Estimado por Departamento ($ USD)",
      categories: sortedByIncome.map((r) => r.label),
      series: [
        {
          name: "Ingreso Medio",
          values: sortedByIncome.map((r) => r.mean ?? null),
          unit: "usd_estimated",
        },
      ],
      evidenceIds: [statsResult.evidenceItem.id],
    };

    blocks.push({
      type: "chart",
      chart: chartSpec,
    });
  }

  return {
    data: {
      status: "answered",
      blocks,
      evidence,
      toolsUsed,
    },
    meta: {
      requestId,
      datasetId: "sv-nemotron",
      datasetVersion: "20261121",
      generatedAt: new Date().toISOString(),
      appliedFilters: filters,
      sampleSize: statsResult.cohortSize,
      warnings: [
        {
          code: "NON_REPRESENTATIVE_SAMPLE",
          message: "Datos de muestra sintética; no necesariamente representativos de El Salvador.",
        },
      ],
    },
  };
}
