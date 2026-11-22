"use client";

import { useEffect, useState } from "react";
import { departmentIdSchema, type Filters } from "@/src/contracts/common";
import type { CatalogResponse } from "@/src/contracts/catalog";
import type { ReportRequest } from "@/src/contracts/reports";

const sections = ["summary", "education", "occupation", "goals", "ai_analysis"] as const;
const metrics: ReportRequest["indicators"] = ["sample_count", "income_mean", "income_median", "financial_exclusion_pct"];
const sectionLabels: Record<(typeof sections)[number], string> = {
  summary: "Resumen e indicadores",
  education: "Educación",
  occupation: "Ocupación",
  goals: "Metas",
  ai_analysis: "Análisis asistido por IA (si está disponible)",
};

export function ReportConfigurator({ filters, onChangeFilters }: {
  filters: Filters;
  onChangeFilters: (filters: Filters) => void;
}) {
  const [catalog, setCatalog] = useState<CatalogResponse["data"]>();
  const [selectedMetrics, setSelectedMetrics] = useState<ReportRequest["indicators"]>(metrics);
  const [selectedSections, setSelectedSections] = useState<ReportRequest["sections"]>(["summary", "education"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar el catálogo auditado.");
        const result = await response.json() as CatalogResponse;
        setCatalog(result.data);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Error al cargar catálogo.");
      });
    return () => controller.abort();
  }, []);

  function toggle<T extends string>(values: T[], value: T, update: (next: T[]) => void, max: number) {
    if (values.includes(value)) {
      if (values.length > 1) update(values.filter((item) => item !== value));
    } else if (values.length < max) update([...values, value]);
  }

  async function download() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    let objectUrl: string | undefined;
    try {
      const response = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      setMessage("Descarga iniciada.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error durante la generación del reporte.");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setBusy(false);
    }
  }

  return <section className="space-y-5 rounded-2xl border bg-white p-5">
    <h2 className="text-lg font-semibold">Filtros — se conservan en la URL</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Departamentos
        <select multiple value={filters.departmentIds ?? []} onChange={(e) => {
          const ids = Array.from(e.target.selectedOptions, (o) => o.value)
            .filter((id) => departmentIdSchema.safeParse(id).success) as NonNullable<Filters["departmentIds"]>;
          onChangeFilters({ ...filters, departmentIds: ids.length ? ids : undefined });
        }} className="mt-1 block min-h-28 w-full rounded border p-2">
          {(catalog?.departments ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-sm">Educación
        <select value={filters.educationIds?.[0] ?? ""} onChange={(e) => onChangeFilters({ ...filters, educationIds: e.target.value ? [e.target.value] : undefined })} className="mt-1 block w-full rounded border p-2">
          <option value="">Todos</option>{(catalog?.education ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-sm">Ocupación
        <select value={filters.occupationIds?.[0] ?? ""} onChange={(e) => onChangeFilters({ ...filters, occupationIds: e.target.value ? [e.target.value] : undefined })} className="mt-1 block w-full rounded border p-2">
          <option value="">Todas</option>{(catalog?.occupations ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <label className="text-sm">Meta
        <select value={filters.goalIds?.[0] ?? ""} onChange={(e) => onChangeFilters({ ...filters, goalIds: e.target.value ? [e.target.value] : undefined })} className="mt-1 block w-full rounded border p-2">
          <option value="">Todas</option>{(catalog?.goals ?? []).map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </label>
      <fieldset className="text-sm"><legend>Ingreso estimado (USD)</legend>
        <div className="mt-1 flex gap-2">
          <input aria-label="Ingreso mínimo" type="number" min="0" placeholder="Mínimo" value={filters.income?.min ?? ""} onChange={(e) => onChangeFilters({ ...filters, income: e.target.value || filters.income?.max !== undefined ? { min: e.target.value ? Number(e.target.value) : undefined, max: filters.income?.max } : undefined })} className="w-full rounded border p-2" />
          <input aria-label="Ingreso máximo" type="number" min="0" placeholder="Máximo" value={filters.income?.max ?? ""} onChange={(e) => onChangeFilters({ ...filters, income: e.target.value || filters.income?.min !== undefined ? { min: filters.income?.min, max: e.target.value ? Number(e.target.value) : undefined } : undefined })} className="w-full rounded border p-2" />
        </div>
      </fieldset>
    </div>
    <fieldset><legend className="font-semibold">Indicadores</legend><div className="flex flex-wrap gap-4">
      {metrics.map((metric) => <label key={metric} className="text-sm"><input type="checkbox" checked={selectedMetrics.includes(metric)} onChange={() => toggle(selectedMetrics, metric, (next) => setSelectedMetrics(next as typeof selectedMetrics), 4)} /> {catalog?.indicators.find((item) => item.id === metric)?.label ?? metric}</label>)}
    </div><p className="text-xs text-zinc-500">Seleccione entre 1 y 4.</p></fieldset>
    <fieldset><legend className="font-semibold">Secciones</legend><div className="flex flex-wrap gap-4">
      {sections.map((section) => <label key={section} className="text-sm"><input type="checkbox" checked={selectedSections.includes(section)} onChange={() => toggle(selectedSections, section, (next) => setSelectedSections(next as typeof selectedSections), 5)} /> {sectionLabels[section]}</label>)}
    </div><p className="text-xs text-zinc-500">Seleccione entre 1 y 5. La narrativa asistida puede no estar disponible; el PDF conserva el reporte estadístico.</p></fieldset>
    <p className="text-xs text-zinc-600">{catalog ? `Fuente: ${catalog.dataset.sourceLabel}. Ingresos estimados, período ${catalog.income.period ?? "no documentado"}. Supresión de privacidad para muestras menores a ${catalog.privacy.minimumPublishableN}. Seleccione departamentos concretos o deje la selección vacía para toda la muestra.` : "Cargando catálogo auditado..."}</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm text-green-700">{message}</p>}
    <button type="button" disabled={busy || !selectedMetrics.length || !selectedSections.length} onClick={download} className="rounded-lg bg-blue-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Generando…" : "Generar y descargar PDF"}</button>
  </section>;
}
