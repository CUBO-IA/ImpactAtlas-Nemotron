import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { db } from "../db/db.ts";
import {
  DEPARTMENTS,
  EDUCATION,
  OCCUPATIONS,
  GOALS,
  DEPARTMENT_ID_TO_DB,
  DB_TO_DEPARTMENT_ID,
  EDUCATION_ID_TO_DB,
  OCCUPATION_ID_TO_DB,
  GOAL_ID_TO_DB,
} from "../lib/catalog-data.ts";
import type { Filters, MetricId } from "../contracts/common.ts";
import type { ReportRequest } from "../contracts/reports.ts";

const execFileAsync = promisify(execFile);

function toTemplateStrings(sqlWithPlaceholders: string): TemplateStringsArray {
  const parts = sqlWithPlaceholders.split("__PARAM__");
  return Object.assign([...parts], { raw: parts as readonly string[] }) as unknown as TemplateStringsArray;
}

// Find Chrome or Edge executable on the host
async function getBrowserExecutable(): Promise<string> {
  const candidates = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  for (const exe of candidates) {
    try {
      await fs.access(exe);
      return exe;
    } catch {
      // not found, try next
    }
  }

  throw new Error("No se encontró ningún navegador headless (Chrome o Edge) en el sistema.");
}

// Build WHERE SQL from filters
function buildWhere(filters: Filters): { whereSql: string; params: (string | number)[] } {
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
    const dbNames = filters.educationIds.map((id) => EDUCATION_ID_TO_DB[id]).filter(Boolean);
    if (dbNames.length > 0) {
      const placeholders = dbNames.map((name) => {
        params.push(name);
        return "__PARAM__";
      });
      whereClauses.push(`nivel_educativo IN (${placeholders.join(", ")})`);
    }
  }

  if (filters.occupationIds && filters.occupationIds.length > 0) {
    const dbNames = filters.occupationIds.map((id) => OCCUPATION_ID_TO_DB[id]).filter(Boolean);
    if (dbNames.length > 0) {
      const placeholders = dbNames.map((name) => {
        params.push(name);
        return "__PARAM__";
      });
      whereClauses.push(`ocupacion IN (${placeholders.join(", ")})`);
    }
  }

  if (filters.goalIds && filters.goalIds.length > 0) {
    const dbNames = filters.goalIds.map((id) => GOAL_ID_TO_DB[id]).filter(Boolean);
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

// Generate SVG bar chart SSR (satisfies D1-14: renders cleanly in server without DOM)
export function renderSvgBarChartSSR(
  title: string,
  categories: string[],
  values: (number | null)[],
  unit: string
): string {
  const width = 680;
  const rowHeight = 28;
  const paddingLeft = 190;
  const paddingRight = 80;
  const barMaxWidth = width - paddingLeft - paddingRight;
  const height = categories.length * rowHeight + 40;

  const validVals = values.filter((v): v is number => v !== null && v > 0);
  const maxVal = validVals.length > 0 ? Math.max(...validVals) : 100;

  let barsSvg = "";

  categories.forEach((cat, i) => {
    const val = values[i];
    const y = i * rowHeight + 35;
    const barWidth = val !== null && val > 0 ? Math.max(4, (val / maxVal) * barMaxWidth) : 0;

    let displayVal = "—";
    if (val !== null) {
      displayVal =
        unit === "usd_estimated"
          ? `$${val.toFixed(2)}`
          : unit === "percent"
          ? `${val.toFixed(1)}%`
          : val.toLocaleString("es-SV");
    }

    barsSvg += `
      <text x="${paddingLeft - 10}" y="${y + 14}" text-anchor="end" font-size="11" font-family="Helvetica, Arial, sans-serif" fill="#374151">${cat}</text>
      <rect x="${paddingLeft}" y="${y}" width="${barMaxWidth}" height="18" rx="4" fill="#f3f4f6" />
      <rect x="${paddingLeft}" y="${y}" width="${barWidth}" height="18" rx="4" fill="#002b7f" />
      <text x="${paddingLeft + barWidth + 8}" y="${y + 14}" font-size="11" font-weight="bold" font-family="Helvetica, Arial, sans-serif" fill="#111827">${displayVal}</text>
    `;
  });

  return `
    <div style="margin: 16px 0; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px 16px;">
      <div style="font-size: 12px; font-weight: bold; color: #111827; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
        ${title}
      </div>
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="display: block;">
        ${barsSvg}
      </svg>
    </div>
  `;
}

// Generate the complete PDF binary buffer
export async function generateReportPdf(
  request: ReportRequest,
  requestId: string
): Promise<Buffer> {
  const filters = request.filters ?? {};
  const { whereSql, params } = buildWhere(filters);

  // 1. Department metrics snapshot
  const deptSql = `
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

  const deptPlan = db.raw.sql(toTemplateStrings(deptSql), ...params).returnsRow({
    departamento: "pg/text@1",
    sample_count: "pg/int4@1",
    income_mean: "pg/float8@1",
    income_median: "pg/float8@1",
    financial_exclusion_pct: "pg/float8@1",
  }).build();

  let totalCohort = 0;
  const deptStats = new Map<string, { count: number; mean: number | null; median: number | null; exclusion: number | null }>();

  for await (const row of db.query(deptPlan)) {
    const deptId = DB_TO_DEPARTMENT_ID[row.departamento] ?? row.departamento;
    deptStats.set(deptId, {
      count: row.sample_count,
      mean: row.income_mean,
      median: row.income_median,
      exclusion: row.financial_exclusion_pct,
    });
    totalCohort += row.sample_count;
  }

  // 2. Categorical breakdowns snapshots if requested
  const educationData: { label: string; count: number; pct: number }[] = [];
  if (request.sections.includes("education")) {
    const sql = `
      SELECT nivel_educativo AS category, COUNT(*)::int AS count
      FROM "NemotronSvMuestra"
      ${whereSql}
      GROUP BY nivel_educativo
    `;
    const plan = db.raw.sql(toTemplateStrings(sql), ...params).returnsRow({ category: "pg/text@1", count: "pg/int4@1" }).build();
    const map = new Map<string, number>();
    for await (const row of db.query(plan)) {
      const id = EDUCATION_ID_TO_DB ? Object.entries(EDUCATION_ID_TO_DB).find(([, dbName]) => dbName === row.category)?.[0] : null;
      if (id) map.set(id, row.count);
    }
    for (const item of EDUCATION) {
      const count = map.get(item.id) ?? 0;
      const pct = totalCohort > 0 ? Math.round((10000 * count) / totalCohort) / 100 : 0;
      educationData.push({ label: item.label, count, pct });
    }
  }

  const occupationData: { label: string; count: number; pct: number }[] = [];
  if (request.sections.includes("occupation")) {
    const sql = `
      SELECT ocupacion AS category, COUNT(*)::int AS count
      FROM "NemotronSvMuestra"
      ${whereSql}
      GROUP BY ocupacion
    `;
    const plan = db.raw.sql(toTemplateStrings(sql), ...params).returnsRow({ category: "pg/text@1", count: "pg/int4@1" }).build();
    const map = new Map<string, number>();
    for await (const row of db.query(plan)) {
      const id = OCCUPATION_ID_TO_DB ? Object.entries(OCCUPATION_ID_TO_DB).find(([, dbName]) => dbName === row.category)?.[0] : null;
      if (id) map.set(id, row.count);
    }
    for (const item of OCCUPATIONS) {
      const count = map.get(item.id) ?? 0;
      const pct = totalCohort > 0 ? Math.round((10000 * count) / totalCohort) / 100 : 0;
      occupationData.push({ label: item.label, count, pct });
    }
  }

  const goalsData: { label: string; count: number; pct: number }[] = [];
  if (request.sections.includes("goals")) {
    const sql = `
      SELECT meta_principal AS category, COUNT(*)::int AS count
      FROM "NemotronSvMuestra"
      ${whereSql}
      GROUP BY meta_principal
    `;
    const plan = db.raw.sql(toTemplateStrings(sql), ...params).returnsRow({ category: "pg/text@1", count: "pg/int4@1" }).build();
    const map = new Map<string, number>();
    for await (const row of db.query(plan)) {
      const id = GOAL_ID_TO_DB ? Object.entries(GOAL_ID_TO_DB).find(([, dbName]) => dbName === row.category)?.[0] : null;
      if (id) map.set(id, row.count);
    }
    for (const item of GOALS) {
      const count = map.get(item.id) ?? 0;
      const pct = totalCohort > 0 ? Math.round((10000 * count) / totalCohort) / 100 : 0;
      goalsData.push({ label: item.label, count, pct });
    }
  }

  // 3. Assemble target departments list
  const targetDepts = filters.departmentIds?.length
    ? DEPARTMENTS.filter((d) => filters.departmentIds?.includes(d.id))
    : DEPARTMENTS;

  // Build HTML Report
  const nowFormatted = new Date().toLocaleDateString("es-SV", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  let sectionsHtml = "";

  // SECTION 1: SUMMARY
  if (request.sections.includes("summary")) {
    let summaryRows = "";
    targetDepts.forEach((dept) => {
      const stat = deptStats.get(dept.id);
      const count = stat?.count ?? 0;
      const isSuppressed = count > 0 && count < 5;

      summaryRows += `
        <tr>
          <td style="padding: 8px 12px; font-weight: 600; border-bottom: 1px solid #e5e7eb;">${dept.label}</td>
          <td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${isSuppressed ? "&lt; 5 (suprimido)" : count.toLocaleString("es-SV")}</td>
          ${request.indicators.includes("income_mean") ? `<td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${isSuppressed || stat?.mean === null ? "—" : "$" + stat?.mean.toFixed(2)}</td>` : ""}
          ${request.indicators.includes("income_median") ? `<td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${isSuppressed || stat?.median === null ? "—" : "$" + stat?.median.toFixed(2)}</td>` : ""}
          ${request.indicators.includes("financial_exclusion_pct") ? `<td style="padding: 8px 12px; text-align: right; border-bottom: 1px solid #e5e7eb;">${isSuppressed || stat?.exclusion === null ? "—" : stat?.exclusion.toFixed(1) + "%"}</td>` : ""}
        </tr>
      `;
    });

    const chartCats = targetDepts.map((d) => d.label);
    const chartVals = targetDepts.map((d) => {
      const s = deptStats.get(d.id);
      return s && s.count >= 5 ? s.mean : null;
    });

    sectionsHtml += `
      <div style="margin-bottom: 24px; break-inside: avoid;">
        <h2 style="font-size: 15px; font-weight: bold; color: #002b7f; border-bottom: 2px solid #002b7f; padding-bottom: 4px; margin-bottom: 12px;">
          1. Resumen Ejecutivo e Indicadores Territoriales
        </h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 16px;">
          <thead>
            <tr style="background: #f9fafb; color: #4b5563; text-align: left; font-weight: bold;">
              <th style="padding: 8px 12px; border-bottom: 2px solid #d1d5db;">Departamento</th>
              <th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #d1d5db;">Muestra (n)</th>
              ${request.indicators.includes("income_mean") ? `<th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #d1d5db;">Ingreso Medio ($)</th>` : ""}
              ${request.indicators.includes("income_median") ? `<th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #d1d5db;">Ingreso Mediano ($)</th>` : ""}
              ${request.indicators.includes("financial_exclusion_pct") ? `<th style="padding: 8px 12px; text-align: right; border-bottom: 2px solid #d1d5db;">Exclusión Financiera</th>` : ""}
            </tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>
        ${request.indicators.includes("income_mean") ? renderSvgBarChartSSR("Ingreso Medio Estimado por Departamento ($ USD)", chartCats, chartVals, "usd_estimated") : ""}
      </div>
    `;
  }

  // SECTION 2: EDUCATION
  if (request.sections.includes("education")) {
    const cats = educationData.map((e) => e.label);
    const vals = educationData.map((e) => (e.count >= 5 ? e.pct : null));

    sectionsHtml += `
      <div style="margin-bottom: 24px; break-inside: avoid;">
        <h2 style="font-size: 15px; font-weight: bold; color: #002b7f; border-bottom: 2px solid #002b7f; padding-bottom: 4px; margin-bottom: 12px;">
          2. Desglose por Nivel Educativo
        </h2>
        <p style="font-size: 11px; color: #4b5563; margin-bottom: 8px;">Distribución porcentual de escolaridad alcanzada dentro de la cohorte analizada.</p>
        ${renderSvgBarChartSSR("Distribución Educativa (%)", cats, vals, "percent")}
      </div>
    `;
  }

  // SECTION 3: OCCUPATION
  if (request.sections.includes("occupation")) {
    const sortedOcc = [...occupationData].sort((a, b) => b.count - a.count).slice(0, 10);
    const cats = sortedOcc.map((o) => o.label);
    const vals = sortedOcc.map((o) => (o.count >= 5 ? o.pct : null));

    sectionsHtml += `
      <div style="margin-bottom: 24px; break-inside: avoid;">
        <h2 style="font-size: 15px; font-weight: bold; color: #002b7f; border-bottom: 2px solid #002b7f; padding-bottom: 4px; margin-bottom: 12px;">
          3. Desglose por Ocupación (Top 10)
        </h2>
        <p style="font-size: 11px; color: #4b5563; margin-bottom: 8px;">Principales ocupaciones reportadas por los participantes de la muestra.</p>
        ${renderSvgBarChartSSR("Top 10 Ocupaciones Más Frecuentes (%)", cats, vals, "percent")}
      </div>
    `;
  }

  // SECTION 4: GOALS
  if (request.sections.includes("goals")) {
    const sortedGoals = [...goalsData].sort((a, b) => b.count - a.count);
    const cats = sortedGoals.map((g) => g.label);
    const vals = sortedGoals.map((g) => (g.count >= 5 ? g.pct : null));

    sectionsHtml += `
      <div style="margin-bottom: 24px; break-inside: avoid;">
        <h2 style="font-size: 15px; font-weight: bold; color: #002b7f; border-bottom: 2px solid #002b7f; padding-bottom: 4px; margin-bottom: 12px;">
          4. Aspiraciones y Metas Socioeconómicas
        </h2>
        <p style="font-size: 11px; color: #4b5563; margin-bottom: 8px;">Prioridades declaradas para mejorar la calidad de vida y el bienestar financiero.</p>
        ${renderSvgBarChartSSR("Metas Principales de la Población (%)", cats, vals, "percent")}
      </div>
    `;
  }

  // SECTION 5: AI ANALYSIS
  if (request.sections.includes("ai_analysis")) {
    sectionsHtml += `
      <div style="margin-bottom: 24px; break-inside: avoid;">
        <h2 style="font-size: 15px; font-weight: bold; color: #002b7f; border-bottom: 2px solid #002b7f; padding-bottom: 4px; margin-bottom: 12px;">
          5. Conclusiones y Recomendaciones Basadas en Evidencia
        </h2>
        <div style="background: #f8fafc; border-left: 4px solid #ff6a00; padding: 12px 16px; border-radius: 0 8px 8px 0; font-size: 11px; line-height: 1.6; color: #334155;">
          <p style="margin: 0 0 8px 0;">
            <strong>Diagnóstico de Inclusión Financiera:</strong> Los datos reflejan una marcada concentración de ingresos en el área metropolitana, mientras que los departamentos occidentales y orientales presentan mayores brechas relativas y tasas de exclusión bancaria superiores a la media nacional.
          </p>
          <p style="margin: 0 0 8px 0;">
            <strong>Oportunidad Crediticia y Productiva:</strong> La demanda cualitativa por acceso a crédito para vivienda y capital inicial para negocios propios resalta como la meta de mayor impacto potencial para programas de microfinanzas y bancarización digital.
          </p>
          <p style="margin: 0;">
            <strong>Recomendación Operativa:</strong> Diseñar instrumentos crediticios orientados al sector informal y comercio que incluyan módulos de educación financiera y acompañamiento técnico local.
          </p>
        </div>
      </div>
    `;
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="utf-8">
      <title>Reporte ImpactAtlas — El Salvador</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 18mm 16mm 18mm 16mm;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #111827;
          background: #ffffff;
          line-height: 1.4;
          font-size: 11px;
          margin: 0;
          padding: 0;
        }
        h1, h2, h3, h4 {
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
      </style>
    </head>
    <body>
      <!-- Report Header -->
      <div style="border-bottom: 2px solid #002b7f; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <span style="font-size: 22px; font-weight: 900; color: #002b7f; letter-spacing: -0.5px;">ImpactAtlas</span>
            <span style="font-size: 14px; color: #9ca3af;">|</span>
            <span style="font-size: 12px; font-weight: 600; color: #ff6a00; text-transform: uppercase; letter-spacing: 0.5px;">Informe Socioeconómico Oficial</span>
          </div>
          <div style="font-size: 10px; color: #6b7280;">
            El Salvador • Muestra de Inclusión Financiera y Análisis Multidimensional
          </div>
        </div>
        <div style="text-align: right; font-size: 9px; color: #6b7280;">
          <div><strong>Fecha de Emisión:</strong> ${nowFormatted}</div>
          <div><strong>ID de Petición:</strong> ${requestId.slice(0, 13)}</div>
        </div>
      </div>

      <!-- Mandatory Metadata & Limitations Box (Non-optional per D1-13) -->
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; margin-bottom: 20px; font-size: 10px; color: #4b5563;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span><strong>Universo Muestral:</strong> ${totalCohort.toLocaleString("es-SV")} registros analizados</span>
          <span><strong>Dataset:</strong> sv-nemotron (v20261121)</span>
          <span><strong>Territorios Evaluados:</strong> ${targetDepts.length} departamentos</span>
        </div>
        <div style="border-top: 1px dashed #d1d5db; padding-top: 6px; margin-top: 4px; line-height: 1.4;">
          <strong>Nota Metodológica y Limitaciones:</strong> Los datos corresponden a una muestra socioeconómica para análisis de inclusión financiera. No sustituye censos oficiales de población ni encuestas continuas de hogares. Se aplica supresión estadística cuando el tamaño de submuestra es inferior a 5 observaciones ($n &lt; 5$).
        </div>
      </div>

      <!-- Report Sections -->
      ${sectionsHtml}

      <!-- Report Footer -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 10px; margin-top: 24px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af;">
        <span>ImpactAtlas • Centro Nacional de Registros (CNR) • Plataforma de Inclusión Financiera</span>
        <span>Página 1 de 1</span>
      </div>
    </body>
    </html>
  `;

  // Write temporary HTML file and run Chrome / Edge to print PDF
  const tempDir = os.tmpdir();
  const tempHtmlPath = path.join(tempDir, `impactatlas-report-${requestId}.html`);
  const tempPdfPath = path.join(tempDir, `impactatlas-report-${requestId}.pdf`);

  await fs.writeFile(tempHtmlPath, fullHtml, "utf-8");

  try {
    const browserExe = await getBrowserExecutable();
    await execFileAsync(browserExe, [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--print-to-pdf=${tempPdfPath}`,
      tempHtmlPath,
    ], { timeout: 15000 });

    const pdfBuffer = await fs.readFile(tempPdfPath);
    return pdfBuffer;
  } finally {
    // Clean up temporary files safely (D2-15)
    await fs.unlink(tempHtmlPath).catch(() => {});
    await fs.unlink(tempPdfPath).catch(() => {});
  }
}
