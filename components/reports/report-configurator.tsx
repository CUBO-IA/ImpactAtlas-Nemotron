"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckSquare, Download, FileText, Loader2, RotateCcw, Square } from "lucide-react";
import { departmentIdSchema, type Filters } from "@/src/contracts/common";
import type { CatalogResponse } from "@/src/contracts/catalog";
import type { ReportRequest } from "@/src/contracts/reports";

const sections = ["summary", "education", "occupation", "goals", "ai_analysis"] as const;
const metrics: ReportRequest["indicators"] = ["sample_count", "income_mean", "income_median", "financial_exclusion_pct"];
const sectionLabels: Record<(typeof sections)[number], string> = {
  summary: "Resumen e indicadores", education: "Educación", occupation: "Ocupación", goals: "Metas", ai_analysis: "Análisis asistido por IA (si está disponible)",
};

export function ReportConfigurator({ filters, onChangeFilters }: { filters: Filters; onChangeFilters: (filters: Filters) => void }) {
  const [catalog, setCatalog] = useState<CatalogResponse["data"]>();
  const [selectedMetrics, setSelectedMetrics] = useState<ReportRequest["indicators"]>(metrics);
  const [selectedSections, setSelectedSections] = useState<ReportRequest["sections"]>(["summary", "education"]);
  const [controller, setController] = useState<AbortController>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const invalidIncome = (filters.income?.min !== undefined && (!Number.isFinite(filters.income.min) || filters.income.min < 0))
    || (filters.income?.max !== undefined && (!Number.isFinite(filters.income.max) || filters.income.max < 0))
    || (filters.income?.min !== undefined && filters.income?.max !== undefined && filters.income.min > filters.income.max);
  const activeFilters = (filters.departmentIds?.length ?? 0) + (filters.educationIds?.length ?? 0)
    + (filters.occupationIds?.length ?? 0) + (filters.goalIds?.length ?? 0) + (filters.income ? 1 : 0);

  useEffect(() => {
    const request = new AbortController();
    fetch("/api/catalog", { signal: request.signal }).then(async (response) => {
      if (!response.ok) throw new Error("No se pudo cargar el catálogo.");
      const result = await response.json() as CatalogResponse;
      setCatalog(result.data);
    }).catch((cause: unknown) => {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Error al cargar catálogo.");
    });
    return () => request.abort();
  }, []);

  function toggle<T extends string>(values: T[], value: T, update: (next: T[]) => void, max: number) {
    if (values.includes(value)) {
      if (values.length > 1) update(values.filter((item) => item !== value));
    } else if (values.length < max) update([...values, value]);
  }

  async function download() {
    if (busy) return;
    const request = new AbortController();
    setController(request); setBusy(true); setError(""); setMessage("");
    let objectUrl: string | undefined;
    try {
      const response = await fetch("/api/reports/pdf", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: request.signal,
        body: JSON.stringify({ filters: Object.keys(filters).length ? filters : undefined, indicators: selectedMetrics, sections: selectedSections }),
      });
      if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/pdf")) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? `No se pudo generar el PDF (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      if (blob.size > 10 * 1024 * 1024) throw new Error("El PDF supera el límite de 10 MiB.");
      objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "impactatlas-reporte.pdf";
      link.click();
      link.remove();
      setMessage("Descarga iniciada.");
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Error durante la generación del reporte.");
    } finally {
      if (objectUrl) {
        const url = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setController(undefined); setBusy(false);
    }
  }

  return <section className="relative space-y-6">
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-5">
        <div>
          <p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#002b7f]">01 / Alcance</p>
          <h2 className="text-lg font-bold text-zinc-950">¿Qué datos quieres incluir?</h2>
          <p className="mt-1 text-sm text-zinc-500">Sin filtros se utiliza toda la muestra disponible.</p>
        </div>
        <button type="button" onClick={() => onChangeFilters({})} disabled={!activeFilters} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-[#002b7f] disabled:opacity-40">
          <RotateCcw className="size-3.5" /> Limpiar filtros {activeFilters > 0 && `(${activeFilters})`}
        </button>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-semibold">Departamentos <span className="font-normal text-zinc-500">· {filters.departmentIds?.length ? `${filters.departmentIds.length} seleccionados` : "Todos"}</span></legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(catalog?.departments ?? []).map((item) => <label key={item.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#002b7f] ${filters.departmentIds?.includes(item.id as NonNullable<Filters["departmentIds"]>[number]) ? "border-[#002b7f] bg-blue-50 text-[#002b7f]" : "border-zinc-200 text-zinc-600 hover:border-blue-300"}`}>
              <input type="checkbox" className="sr-only" checked={filters.departmentIds?.includes(item.id as NonNullable<Filters["departmentIds"]>[number]) ?? false} onChange={(e) => {
                if (!departmentIdSchema.safeParse(item.id).success) return;
                const id = item.id as NonNullable<Filters["departmentIds"]>[number];
                const ids = e.target.checked ? [...(filters.departmentIds ?? []), id] : (filters.departmentIds ?? []).filter((value) => value !== id);
                onChangeFilters({ ...filters, departmentIds: ids.length ? ids : undefined });
              }} />{item.label}
            </label>)}
            {!catalog && <span className="text-sm text-zinc-500">Cargando departamentos…</span>}
          </div>
        </fieldset>
        {([ ["Educación", "educationIds", catalog?.education], ["Ocupación", "occupationIds", catalog?.occupations], ["Meta", "goalIds", catalog?.goals] ] as const).map(([label, key, options]) => <details key={key} className="rounded-xl border border-zinc-200 bg-zinc-50/50">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{label} <span className="font-normal text-zinc-500">· {filters[key]?.length ? `${filters[key].length} seleccionados` : "Todos"}</span></summary>
          <div className="max-h-48 space-y-1 overflow-auto border-t border-zinc-200 p-3">
            {(options ?? []).map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white">
              <input type="checkbox" checked={filters[key]?.includes(item.id) ?? false} onChange={(e) => {
                const ids = e.target.checked ? [...(filters[key] ?? []), item.id] : (filters[key] ?? []).filter((id) => id !== item.id);
                onChangeFilters({ ...filters, [key]: ids.length ? ids : undefined });
              }} className="accent-[#002b7f]" />{item.label}
            </label>)}
          </div>
        </details>)}
        <fieldset className="text-xs font-semibold"><legend>Ingreso estimado (USD)</legend><div className="mt-1 flex gap-2">
          <input aria-label="Ingreso mínimo" type="number" min="0" placeholder="Mínimo" value={filters.income?.min ?? ""} onChange={(e) => onChangeFilters({ ...filters, income: e.target.value || filters.income?.max !== undefined ? { min: e.target.value ? Number(e.target.value) : undefined, max: filters.income?.max } : undefined })} className="w-full rounded-xl border border-zinc-200 p-2 font-normal" />
          <input aria-label="Ingreso máximo" type="number" min="0" placeholder="Máximo" value={filters.income?.max ?? ""} onChange={(e) => onChangeFilters({ ...filters, income: e.target.value || filters.income?.min !== undefined ? { min: filters.income?.min, max: e.target.value ? Number(e.target.value) : undefined } : undefined })} className="w-full rounded-xl border border-zinc-200 p-2 font-normal" />
        </div>{invalidIncome && <p role="alert" className="mt-2 text-xs font-normal text-rose-700">Ingresa valores positivos y verifica que el mínimo no supere el máximo.</p>}</fieldset>
      </div>
    </div>
    <div className="grid gap-6 md:grid-cols-2">
      {[{ title: "Indicadores", items: metrics.map((id) => ({ id, label: catalog?.indicators.find((item) => item.id === id)?.label ?? id })) , selected: selectedMetrics, update: setSelectedMetrics, max: 4 }, { title: "Secciones del reporte", items: sections.map((id) => ({ id, label: sectionLabels[id] })), selected: selectedSections, update: setSelectedSections, max: 5 }].map((group, index) => <div key={group.title} className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="border-b border-zinc-100 pb-4"><p className="mb-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[#002b7f]">{index ? "03 / Contenido" : "02 / Indicadores"}</p>
        <h2 className="text-lg font-bold">{group.title} <span className="ml-1 font-mono text-xs font-normal text-zinc-500">{group.selected.length} / {group.max}</span></h2>
        <p className="mt-1 text-xs text-zinc-500">Selecciona al menos uno.</p></div>
        {group.items.map((item) => <button key={item.id} type="button" aria-pressed={group.selected.includes(item.id as never)} onClick={() => toggle(group.selected, item.id, (next) => group.update(next as never), group.max)} className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[#002b7f] ${group.selected.includes(item.id as never) ? "border-blue-200 bg-blue-50/60 text-[#002b7f]" : "border-zinc-200 bg-white text-zinc-600 hover:border-blue-300"}`}>
          {group.selected.includes(item.id as never) ? <CheckSquare className={index ? "size-4 text-[#ff6a00]" : "size-4 text-[#002b7f]"} /> : <Square className="size-4 text-zinc-300" />}{item.label}
        </button>)}
      </div>)}
    </div>
    <p className="text-xs text-zinc-600">{catalog ? `Fuente: ${catalog.dataset.sourceLabel}. Ingresos estimados, período ${catalog.income.period ?? "no documentado"}. Supresión de privacidad para muestras menores a ${catalog.privacy.minimumPublishableN}. Sin departamentos seleccionados se consulta toda la muestra.` : "Cargando catálogo…"} La narrativa asistida por IA puede no estar disponible.</p>
    {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="size-4" />{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <div className="flex flex-col gap-4 rounded-3xl bg-[#002b7f] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-white/10 p-3"><FileText className="size-5" /></span><div><p className="font-bold">Tu reporte está casi listo</p><p className="mt-1 text-xs text-blue-100">{selectedSections.length} secciones · {selectedMetrics.length} indicadores · {activeFilters ? `${activeFilters} filtros activos` : "Toda la muestra"}</p></div></div>
      <div className="flex gap-2">
        {busy && <button type="button" onClick={() => controller?.abort()} className="rounded-xl border border-white/40 px-4 py-3 text-xs font-bold">Cancelar</button>}
        <button type="button" disabled={busy || !catalog || invalidIncome || !selectedMetrics.length || !selectedSections.length} onClick={download} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-bold text-[#002b7f] hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}{busy ? "Generando PDF…" : "Generar y descargar PDF"}
        </button>
      </div>
    </div>
  </section>;
}
