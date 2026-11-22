import sparticuzChromium from "@sparticuz/chromium";
import * as echarts from "echarts";
import { chromium as playwrightChromium, type Browser } from "playwright-core";
import type { Filters, MetricId } from "../contracts/common.ts";
import type { ReportRequest } from "../contracts/reports.ts";
import type { ChartSpec } from "../contracts/chat.ts";
import { formatChartValue } from "../charts/chart-spec.ts";
import { createReportNarrative } from "./report-narrative.ts";

export type ReportSection = "education" | "occupation" | "goals";
export type DepartmentMetric = Exclude<MetricId, "category_count" | "category_pct">;
export type ReportUnit = "records" | "usd_estimated" | "percent";

export interface ReportMetric {
  readonly value: number | null;
  readonly unit: ReportUnit;
  readonly validN: number | null;
  readonly missingN: number | null;
  readonly suppressed: boolean;
  readonly reason: "empty" | "insufficient_sample" | "complementary_suppression" | null;
}

export interface ReportCategory {
  readonly label: string;
  readonly count: number | null;
  readonly percent: number | null;
  readonly suppressed: boolean;
}

export interface ReportSnapshot {
  readonly snapshotId: string;
  readonly generatedAt: string;
  readonly datasetId: string;
  readonly datasetVersion: string;
  readonly appliedFilters: Filters;
  readonly sampleSize: number | null;
  readonly indicators: Readonly<Record<DepartmentMetric, ReportMetric>>;
  readonly sections: Partial<Readonly<Record<ReportSection, readonly ReportCategory[]>>>;
  readonly warnings: readonly string[];
}

/** Must return one consistent read snapshot and release its transaction before resolving. */
export interface ReportSnapshotProvider {
  getSnapshot(request: ReportRequest): Promise<ReportSnapshot | null>;
}

export class ReportServiceUnavailableError extends Error {
  constructor(message = "El servicio de reportes no está configurado.") {
    super(message);
    this.name = "ReportServiceUnavailableError";
  }
}

export class ReportSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportSnapshotError";
  }
}

export class ReportLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportLimitError";
  }
}

export class ReportConcurrencyError extends Error {
  constructor() {
    super("Ya se está generando otro reporte; inténtalo de nuevo.");
    this.name = "ReportConcurrencyError";
  }
}

export class ReportTimeoutError extends Error {
  constructor() {
    super("La generación del reporte excedió el tiempo permitido.");
    this.name = "ReportTimeoutError";
  }
}

export class ReportCancelledError extends Error {
  constructor() {
    super("La generación del reporte fue cancelada.");
    this.name = "ReportCancelledError";
  }
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_PDF_PAGES = 20;
const MAX_CATEGORIES = 20;
const MAX_CATEGORY_LABEL_LENGTH = 120;
const REPORT_ROWS_PER_PAGE = 10;
const MAX_REPORT_BUDGET_MS = 90_000;
const MIN_PUBLISHABLE_COUNT = 5;
const SECTION_LABELS: Readonly<Record<ReportSection, string>> = {
  education: "Educación",
  occupation: "Ocupación",
  goals: "Metas principales",
};
const METRIC_LABELS: Readonly<Record<DepartmentMetric, string>> = {
  sample_count: "Registros de la muestra",
  income_mean: "Ingreso estimado promedio",
  income_median: "Ingreso estimado mediano",
  financial_exclusion_pct: "Sin acceso financiero",
};

let reportBusy = false;

function safeText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
}

function escapeHtml(value: string): string {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function validateSnapshot(snapshot: ReportSnapshot, request: ReportRequest): void {
  if (!snapshot.snapshotId || !snapshot.datasetId || !snapshot.datasetVersion) {
    throw new ReportSnapshotError("El snapshot no contiene identificadores de procedencia.");
  }
  if (!Number.isFinite(Date.parse(snapshot.generatedAt))) {
    throw new ReportSnapshotError("El snapshot contiene una fecha inválida.");
  }
  if (canonicalJson(snapshot.appliedFilters) !== canonicalJson(request.filters ?? {})) {
    throw new ReportSnapshotError("Los filtros aplicados no coinciden con la solicitud.");
  }
  if (snapshot.warnings.length > 10 || snapshot.warnings.some((warning) => warning.length > 160)) {
    throw new ReportLimitError("El reporte supera el límite de advertencias o texto por advertencia.");
  }
  for (const value of [snapshot.snapshotId, snapshot.datasetId, snapshot.datasetVersion]) {
    if (value.length > 60) throw new ReportLimitError("La procedencia supera el límite de texto.");
  }
  for (const indicator of request.indicators) {
    const metric = snapshot.indicators[indicator];
    if (!metric || (metric.value !== null && !Number.isFinite(metric.value))) {
      throw new ReportSnapshotError(`El snapshot no contiene un valor válido para ${indicator}.`);
    }
    if (metric.suppressed && metric.value !== null) {
      throw new ReportSnapshotError(`El indicador suprimido ${indicator} expone un valor.`);
    }
  }
  for (const section of request.sections) {
    if (section === "summary" || section === "ai_analysis") continue;
    const rows = snapshot.sections[section];
    if (!rows) throw new ReportSnapshotError(`El snapshot no contiene la sección solicitada: ${section}.`);
    if (rows.length > MAX_CATEGORIES) {
      throw new ReportLimitError(`La sección ${section} excede el máximo de ${MAX_CATEGORIES} categorías.`);
    }
    if (rows.some((row) => row.label.length > MAX_CATEGORY_LABEL_LENGTH)) {
      throw new ReportLimitError(`La sección ${section} contiene una categoría demasiado larga.`);
    }
    if (rows.some((row) =>
      (row.count !== null && (!Number.isSafeInteger(row.count) || row.count < 0)) ||
      (row.percent !== null && (!Number.isFinite(row.percent) || row.percent < 0 || row.percent > 100))
    )) {
      throw new ReportSnapshotError(`La sección ${section} contiene valores inválidos.`);
    }
  }
  if (snapshot.sampleSize !== null && (!Number.isSafeInteger(snapshot.sampleSize) || snapshot.sampleSize < 0)) {
    throw new ReportSnapshotError("El snapshot contiene un tamaño de muestra inválido.");
  }
}

function metricValue(metric: ReportMetric): string {
  if (metric.suppressed) return "Suprimido por privacidad";
  if (metric.unit === "records" && metric.value !== null &&
      metric.value > 0 && metric.value < MIN_PUBLISHABLE_COUNT) {
    return "Muestra insuficiente";
  }
  if (metric.validN !== null && metric.validN > 0 && metric.validN < MIN_PUBLISHABLE_COUNT) {
    return "Muestra insuficiente";
  }
  if (metric.value === null) return "Sin datos";
  if (metric.unit === "percent") return `${metric.value.toFixed(2)}%`;
  if (metric.unit === "usd_estimated") return `USD ${metric.value.toFixed(2)}`;
  return Math.round(metric.value).toLocaleString("es-SV");
}

function formatFilters(filters: Filters): string[] {
  const lines: string[] = [];
  const add = (label: string, values: readonly string[] | undefined) => {
    if (!values?.length) return;
    let line = `${label}: `;
    for (const raw of values) {
      const value = safeText(raw.replaceAll("-", " "));
      const next = `${line}${line === `${label}: ` ? "" : ", "}${value}`;
      if (next.length > 80 && line !== `${label}: `) {
        lines.push(line);
        line = `${label}: ${value}`;
      } else {
        line = next;
      }
      if (line.length > 80) throw new ReportLimitError(`El filtro ${label} contiene un valor demasiado largo.`);
    }
    lines.push(line);
  };
  add("Departamentos", filters.departmentIds);
  add("Educación", filters.educationIds);
  add("Ocupación", filters.occupationIds);
  add("Metas", filters.goalIds);
  if (filters.income) {
    lines.push(`Ingreso estimado USD: ${filters.income.min ?? "sin mínimo"} – ${filters.income.max ?? "sin máximo"}`);
  }
  const result = lines.length ? lines : ["Sin filtros"];
  if (result.length > 10) throw new ReportLimitError("Los filtros superan el máximo de 10 líneas.");
  return result;
}

function isPublishable(row: ReportCategory): boolean {
  return !row.suppressed && row.count !== null &&
    (row.count === 0 || row.count >= MIN_PUBLISHABLE_COUNT);
}

export function publishedDistributionMax(rows: readonly ReportCategory[]): number {
  return Math.max(1, ...rows.filter(isPublishable).map(({ count }) => count!));
}

function renderChart(spec: ChartSpec, width = 800): string {
  const byUnit = Map.groupBy(spec.series, ({ unit }) => unit);
  if (byUnit.size > 1) {
    if (byUnit.size > 2) {
      throw new ReportLimitError("El PDF solo puede mostrar gráficos de hasta dos unidades distintas con legibilidad suficiente.");
    }
    const panelWidth = Math.floor((width - 8) / byUnit.size);
    const panels = [...byUnit].map(([unit, series]) =>
      renderChart({ ...spec, title: `${spec.title} · ${unit}`, series }, panelWidth),
    );
    return `<div style="display:grid;grid-template-columns:repeat(${byUnit.size},minmax(0,1fr));gap:8px;align-items:start">${panels.join("")}</div>`;
  }
  const unit = spec.series[0]?.unit ?? "records";
  const chartHeight = Math.max(260, spec.categories.length * 30);
  const chart = echarts.init(null, null, {
    renderer: "svg",
    ssr: true,
    width,
    height: chartHeight,
    locale: "EN",
  });
  try {
    chart.setOption({
      animation: false,
      color: ["#002b7f", "#ff6a00", "#10b981", "#8b5cf6"],
      legend: spec.series.length > 1 ? { top: 4, left: 12, textStyle: { color: "#4b5d6b" } } : { show: false },
      grid: { left: width < 800 ? 125 : 205, right: 75, top: spec.series.length > 1 ? 32 : 12, bottom: 38 },
      xAxis: {
        type: "value", min: Math.min(0, ...spec.series.flatMap(({ values }) => values.filter((value): value is number => value !== null))),
        name: unit === "records" ? "Registros" : unit,
        nameLocation: "middle", nameGap: 24,
        axisLabel: {
          color: "#4b5d6b",
          formatter: (value: string | number) => formatChartValue(Number(value), unit),
        },
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: spec.categories.map((category) => safeText(category)),
        axisLabel: {
          color: "#263746",
          width: width < 800 ? 105 : 180,
          overflow: "break",
          lineHeight: 13,
          fontSize: 10,
        },
      },
      series: spec.series.map((item) => ({
        type: "bar",
        name: item.name,
        data: item.values,
        barMaxWidth: 18,
        barGap: spec.type === "grouped_bar" ? "15%" : "30%",
        label: { show: spec.series.length === 1, position: "right", formatter: ({ value }: { value: number | null }) => formatChartValue(value, item.unit) },
      })),
    });
    const svg = chart.renderToSVGString({ useViewBox: true });
    if (!svg.startsWith("<svg") || /<(?:script|foreignObject|image|iframe)\b|\b(?:href|xlink:href)\s*=|url\(\s*(?!#)/i.test(svg)) {
      throw new ReportSnapshotError("El SVG generado contiene recursos no permitidos.");
    }
    return `<div class="chart-title">${escapeHtml(spec.title)}</div>${svg}`;
  } finally {
    chart.dispose();
  }
}

function fmtCount(row: ReportCategory): string {
  return isPublishable(row) ? row.count!.toLocaleString("es-SV") : "Suprimido";
}

function fmtPercent(row: ReportCategory): string {
  return isPublishable(row) && row.percent !== null ? `${row.percent.toFixed(1)}%` : "Suprimido";
}

function renderRows(rows: readonly ReportCategory[]): string {
  return rows.map((row) => `<tr>
    <td>${escapeHtml(row.label || "Sin dato")}</td>
    <td class="numeric">${fmtCount(row)}</td>
    <td class="numeric">${fmtPercent(row)}</td>
  </tr>`).join("");
}

function renderTable(rows: readonly ReportCategory[]): string {
  return `<table><thead><tr><th>Categoría</th><th>Registros</th><th>%</th></tr></thead><tbody>${renderRows(rows)}</tbody></table>`;
}

function sectionPageCount(rows: readonly ReportCategory[]): number {
  return Math.max(1, Math.ceil(rows.length / REPORT_ROWS_PER_PAGE));
}

function reportPageCount(request: ReportRequest, snapshot: ReportSnapshot): number {
  return 1 + request.sections.reduce((count, section) => {
    if (section === "summary" || section === "ai_analysis") return count;
    return count + sectionPageCount(snapshot.sections[section]!);
  }, 0);
}

function renderPage(title: string, contents: string, continued = false): string {
  return `<section class="page">
    <header><h1>${escapeHtml(title)}${continued ? " — continuación" : ""}</h1></header>
    ${contents}
    <footer>Datos de muestra; no necesariamente representativos de El Salvador. Ingresos estimados; asociaciones no implican causalidad.</footer>
  </section>`;
}

function renderHtml(
  request: ReportRequest,
  snapshot: ReportSnapshot,
  narrative?: { paragraphs: string[]; warning?: string },
): string {
  const warnings = [...snapshot.warnings];
  if (request.sections.includes("ai_analysis")) {
    if (narrative?.warning) warnings.push(narrative.warning);
  }
  const indicators = request.indicators.map((id) => `<li><strong>${escapeHtml(METRIC_LABELS[id])}:</strong> ${escapeHtml(metricValue(snapshot.indicators[id]))}</li>`).join("");
  const filters = formatFilters(snapshot.appliedFilters).map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  const summary = `<p><strong>Fuente:</strong> ${escapeHtml(snapshot.datasetId)} · versión ${escapeHtml(snapshot.datasetVersion)}</p>
    <p><strong>Snapshot:</strong> ${escapeHtml(snapshot.snapshotId)} · ${escapeHtml(new Date(snapshot.generatedAt).toLocaleString("es-SV"))}</p>
    <p><strong>Tamaño de muestra:</strong> ${snapshot.sampleSize === null
      ? "Suprimido o no disponible"
      : snapshot.sampleSize > 0 && snapshot.sampleSize < MIN_PUBLISHABLE_COUNT
        ? "Muestra insuficiente"
        : snapshot.sampleSize.toLocaleString("es-SV")}</p>
    <h2>Filtros aplicados</h2><ul>${filters}</ul>
    <h2>Indicadores</h2><ul>${indicators}</ul>
    ${request.sections.includes("ai_analysis") && narrative?.paragraphs.length
      ? `<h2>Análisis asistido por Qwen3.5 local</h2>${narrative.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}`
      : ""}
    <h2>Advertencias</h2><ul>${warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("") || "<li>Sin advertencias</li>"}</ul>
    <h2>Limitaciones</h2><p>Muestra descriptiva, no necesariamente representativa de El Salvador. Los ingresos son estimados; asociaciones no implican causalidad.</p>`;

  const pages = [renderPage("Reporte estadístico", summary)];
  for (const section of request.sections) {
    if (section === "summary" || section === "ai_analysis") continue;
    const rows = snapshot.sections[section]!;
    const publicRows = rows.filter(isPublishable);
    const chartSpec = {
      type: "bar",
      title: SECTION_LABELS[section],
      categories: publicRows.map(({ label }) => label || "Sin dato"),
      series: [{
        name: "Registros",
        values: publicRows.map(({ count }) => count),
        unit: "records",
      }],
      evidenceIds: [],
    } satisfies ChartSpec;
    const [firstPageRows, ...continuedRows] = Array.from(
      { length: sectionPageCount(rows) },
      (_, index) => rows.slice(index * REPORT_ROWS_PER_PAGE, (index + 1) * REPORT_ROWS_PER_PAGE),
    );
    pages.push(renderPage(
      SECTION_LABELS[section],
      `<h2>${escapeHtml(SECTION_LABELS[section])}</h2>${renderChart(chartSpec)}${renderTable(firstPageRows)}`,
    ));
    for (const pageRows of continuedRows) {
      pages.push(renderPage(
        SECTION_LABELS[section],
        renderTable(pageRows),
        true,
      ));
    }
  }
  if (pages.length > MAX_PDF_PAGES) throw new ReportLimitError(`El reporte supera el máximo de ${MAX_PDF_PAGES} páginas.`);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'none'; font-src 'none'; style-src 'unsafe-inline'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">
    <style>
      @page { size: A4; margin: 13mm 14mm 17mm; }
      * { box-sizing: border-box; }
      body { margin: 0; color: #263746; font: 10pt Arial, sans-serif; }
      .page { position: relative; height: 267mm; break-after: page; page-break-after: always; overflow: hidden; }
      .page:last-child { break-after: auto; page-break-after: auto; }
      header { border-bottom: 1px solid #d8e0e8; margin-bottom: 8mm; }
      h1 { margin: 0 0 4mm; color: #17324d; font-size: 20pt; }
      h2 { margin: 5mm 0 2mm; color: #17324d; font-size: 12pt; }
      p { margin: 2mm 0; line-height: 1.35; }
      ul { margin: 1mm 0 2mm; padding-left: 5mm; }
      li { margin: 1mm 0; }
      svg { display: block; width: 100%; height: auto; max-height: 150mm; }
      table { width: 100%; border-collapse: collapse; font-size: 9pt; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      th, td { padding: 2mm; border-bottom: 1px solid #d8e0e8; text-align: left; }
      th { color: #17324d; }
      td:first-child { overflow-wrap: anywhere; }
      .numeric { text-align: right; }
      footer { position: absolute; bottom: 0; left: 0; right: 0; border-top: 1px solid #d8e0e8; padding-top: 2mm; color: #5d6b78; font-size: 7pt; }
    </style></head><body>${pages.join("")}</body></html>`;
}

function abortError(signal: AbortSignal): Error {
  return signal.reason?.name === "TimeoutError" ? new ReportTimeoutError() : new ReportCancelledError();
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError(signal);
}

function awaitWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener("abort", onAbort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function renderInChromium(html: string, signal: AbortSignal): Promise<Uint8Array> {
  let browser: Browser | undefined;
  let context: Awaited<ReturnType<Browser["newContext"]>> | undefined;
  let closePromise: Promise<void> | undefined;
  const closeBrowser = () => {
    if (!browser) return Promise.resolve();
    closePromise ??= browser.close().catch(() => {});
    return closePromise;
  };
  const closeOnAbort = () => { void closeBrowser(); };
  signal.addEventListener("abort", closeOnAbort, { once: true });
  try {
    const executablePath = await awaitWithAbort(sparticuzChromium.executablePath(), signal);
    browser = await playwrightChromium.launch({
      args: [...sparticuzChromium.args, "--disable-background-networking", "--disable-sync"],
      executablePath,
      headless: true,
      timeout: 8_000,
    });
    if (signal.aborted) throw abortError(signal);
    context = await awaitWithAbort(browser.newContext({
      serviceWorkers: "block",
      acceptDownloads: false,
      javaScriptEnabled: false,
    }), signal);
    await awaitWithAbort(context.route("**/*", (route) => route.abort()), signal);
    const page = await awaitWithAbort(context.newPage(), signal);
    page.setDefaultTimeout(5_000);
    await awaitWithAbort(page.setContent(html, { waitUntil: "load", timeout: 8_000 }), signal);
    const pdf = await awaitWithAbort(page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    }), signal);
    if (pdf.byteLength > MAX_PDF_BYTES) {
      throw new ReportLimitError("El PDF supera el máximo de 10 MiB.");
    }
    return new Uint8Array(pdf);
  } catch (error) {
    if (signal.aborted) throw abortError(signal);
    throw error;
  } finally {
    signal.removeEventListener("abort", closeOnAbort);
    await context?.close().catch(() => {});
    await closeBrowser();
  }
}

async function withReportSlot<T>(task: () => Promise<T>): Promise<T> {
  if (reportBusy) throw new ReportConcurrencyError();
  reportBusy = true;
  try {
    return await task();
  } finally {
    reportBusy = false;
  }
}

function reportBudget(callerSignal?: AbortSignal): AbortSignal {
  const deadline = AbortSignal.timeout(MAX_REPORT_BUDGET_MS);
  return callerSignal ? AbortSignal.any([callerSignal, deadline]) : deadline;
}

async function renderReportPdfWithinBudget(
  request: ReportRequest,
  snapshot: ReportSnapshot,
  signal: AbortSignal,
  narrative?: { paragraphs: string[]; warning?: string },
): Promise<Uint8Array> {
  throwIfAborted(signal);
  validateSnapshot(snapshot, request);
  const expectedPages = reportPageCount(request, snapshot);
  if (expectedPages > MAX_PDF_PAGES) throw new ReportLimitError("El reporte supera el máximo de 20 páginas.");
  if (request.sections.includes("ai_analysis") && !narrative) {
    narrative = { paragraphs: [], warning: "Análisis IA no disponible; se conserva el reporte estadístico." };
  }
  return renderInChromium(renderHtml(request, snapshot, narrative), signal);
}

export async function renderReportPdf(
  request: ReportRequest,
  snapshot: ReportSnapshot,
  callerSignal?: AbortSignal,
): Promise<Uint8Array> {
  return withReportSlot(() =>
    renderReportPdfWithinBudget(request, snapshot, reportBudget(callerSignal)),
  );
}

export async function generateReportPdf(
  request: ReportRequest,
  provider: ReportSnapshotProvider | undefined,
  callerSignal?: AbortSignal,
): Promise<Uint8Array> {
  return withReportSlot(async () => {
    const signal = reportBudget(callerSignal);
    if (!provider) throw new ReportServiceUnavailableError();
    // The provider currently has no AbortSignal parameter; its read-only transaction has its own 6s timeout.
    const snapshot = await awaitWithAbort(provider.getSnapshot(request), signal);
    throwIfAborted(signal);
    if (!snapshot) throw new ReportServiceUnavailableError("No hay un snapshot consistente disponible.");
    const narrative = request.sections.includes("ai_analysis")
      ? await createReportNarrative(request, snapshot, signal)
      : undefined;
    throwIfAborted(signal);
    return renderReportPdfWithinBudget(request, snapshot, signal, narrative);
  });
}
