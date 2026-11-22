"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckSquare, Download, Loader2, Square } from "lucide-react";
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
      const link = document.createElement("a"); link.href = objectUrl; link.download = "impactatlas-reporte.pdf"; link.click();
      setMessage("Descarga iniciada.");
    } catch (cause) {
      if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : "Error durante la generación del reporte.");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setController(undefined); setBusy(false);
    }
  }

  return <section className="space-y-6">
    <div className="glass-surface hud-bracket rounded-3xl p-6 shadow-sm">
      <div className="mb-4 border-b border-zinc-200/60 pb-3">
        <span className="flex size-2 rounded-full bg-[#002b7f]" />
        <h2 className="text-sm font-extrabold text-zinc-950">Filtros del reporte</h2>
        <p className="text-[11px] text-zinc-500">Persisten en la URL y se aplican a los datos disponibles.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold">Departamentos
          <select multiple value={filters.departmentIds ?? []} onChange={(e) => {
            const ids = Array.from(e.target.selectedOptions, (option) => option.value).filter((id) => departmentIdSchema.safeParse(id).success) as NonNullable<Filters["departmentIds"]>;
            onChangeFilters({ ...filters, departmentIds: ids.length ? ids : undefined });
          }} className="mt-1 block min-h-28 w-full rounded-xl border border-zinc-200 bg-white p-2 font-normal">
            {(catalog?.departments ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        {([ ["Educación", "educationIds", catalog?.education, "Todos"], ["Ocupación", "occupationIds", catalog?.occupations, "Todas"], ["Meta", "goalIds", catalog?.goals, "Todas"] ] as const).map(([label, key, options, empty]) => <label key={key} className="text-xs font-semibold">{label}
          <select value={filters[key]?.[0] ?? ""} onChange={(e) => onChangeFilters({ ...filters, [key]: e.target.value ? [e.target.value] : undefined })} className="mt-1 block w-full rounded-xl border border-zinc-200 bg-white p-2 font-normal">
            <option value="">{empty}</option>{(options ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>)}
        <fieldset className="text-xs font-semibold"><legend>Ingreso estimado (USD)</legend><div className="mt-1 flex gap-2">
          <input aria-label="Ingreso mínimo" type="number" min="0" placeholder="Mínimo" value={filters.income?.min ?? ""} onChange={(e) => onChangeFilters({ ...filters, income: e.target.value || filters.income?.max !== undefined ? { min: e.target.value ? Number(e.target.value) : undefined, max: filters.income?.max } : undefined })} className="w-full rounded-xl border border-zinc-200 p-2 font-normal" />
          <input aria-label="Ingreso máximo" type="number" min="0" placeholder="Máximo" value={filters.income?.max ?? ""} onChange={(e) => onChangeFilters({ ...filters, income: e.target.value || filters.income?.min !== undefined ? { min: filters.income?.min, max: e.target.value ? Number(e.target.value) : undefined } : undefined })} className="w-full rounded-xl border border-zinc-200 p-2 font-normal" />
        </div></fieldset>
      </div>
    </div>
    <div className="grid gap-6 md:grid-cols-2">
      {[{ title: "Indicadores Estadísticos", items: metrics.map((id) => ({ id, label: catalog?.indicators.find((item) => item.id === id)?.label ?? id })) , selected: selectedMetrics, update: setSelectedMetrics, max: 4 }, { title: "Secciones del Informe", items: sections.map((id) => ({ id, label: sectionLabels[id] })), selected: selectedSections, update: setSelectedSections, max: 5 }].map((group, index) => <div key={group.title} className="glass-surface hud-bracket space-y-3 rounded-3xl p-6 shadow-sm">
        <h2 className="border-b border-zinc-200/60 pb-3 text-sm font-extrabold">{group.title} <span className="font-mono text-xs text-[#002b7f]">{group.selected.length} / {group.max}</span></h2>
        {group.items.map((item) => <button key={item.id} type="button" onClick={() => toggle(group.selected, item.id, (next) => group.update(next as never), group.max)} className="flex w-full items-center gap-3 rounded-2xl border border-zinc-200/80 bg-white/70 p-3 text-left text-xs font-bold hover:border-blue-300">
          {group.selected.includes(item.id as never) ? <CheckSquare className={index ? "size-4 text-[#ff6a00]" : "size-4 text-[#002b7f]"} /> : <Square className="size-4 text-zinc-300" />}{item.label}
        </button>)}
      </div>)}
    </div>
    <p className="text-xs text-zinc-600">{catalog ? `Fuente: ${catalog.dataset.sourceLabel}. Ingresos estimados, período ${catalog.income.period ?? "no documentado"}. Supresión de privacidad para muestras menores a ${catalog.privacy.minimumPublishableN}. Sin departamentos seleccionados se consulta toda la muestra.` : "Cargando catálogo…"} La narrativa asistida por IA puede no estar disponible.</p>
    {error && <p role="alert" className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertTriangle className="size-4" />{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <div className="glass-surface hud-bracket flex flex-col gap-4 rounded-3xl p-6 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-bold">Listo: {selectedSections.length} secciones, {selectedMetrics.length} indicadores</span>
      <div className="flex gap-2">
        {busy && <button type="button" onClick={() => controller?.abort()} className="rounded-2xl border px-4 py-3 text-xs font-bold">Cancelar</button>}
        <button type="button" disabled={busy || !catalog || !selectedMetrics.length || !selectedSections.length} onClick={download} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#002b7f] to-[#001d54] px-7 py-3 text-xs font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4 text-orange-400" />}{busy ? "Generando PDF…" : "Generar y descargar PDF"}
        </button>
      </div>
    </div>
  </section>;
}
