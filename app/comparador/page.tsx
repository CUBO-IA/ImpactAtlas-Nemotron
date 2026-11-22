"use client";

import React, { Suspense, useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { SiteFooter } from "@/components/navigation/site-footer";
import type { DepartmentId, Filters, MetricId } from "@/src/contracts/common";
import type { CompareResponse } from "@/src/contracts/compare";
import { DepartmentSelector } from "@/components/compare/department-selector";
import { ComparisonTable } from "@/components/compare/comparison-table";
import { BreakdownComparison } from "@/components/compare/breakdown-comparison";
import { FilterBar } from "@/components/filters/filter-bar";
import { filterSearchParams } from "@/src/lib/filter-url";
import {
  GitCompare,
  BarChart3,
  AlertCircle,
  Loader2,
} from "lucide-react";

const DEFAULT_DEPTS: DepartmentId[] = ["san-salvador", "santa-ana"];
const DEFAULT_REF: DepartmentId = "san-salvador";
const ALL_METRICS: MetricId[] = [
  "income_mean",
  "income_median",
  "financial_exclusion_pct",
  "sample_count",
];

function ComparadorContent({ query }: { query: string }) {
  const router = useRouter();
  const searchParams = React.useMemo(() => new URLSearchParams(query), [query]);

  // Initialize selected departments from URL
  const initialDepts = (() => {
    const raw = searchParams.get("depts") ?? searchParams.get("dept");
    if (raw) {
      const parts = raw.split(",").map((s) => s.trim()) as DepartmentId[];
      if (parts.length >= 1) return parts;
    }
    return DEFAULT_DEPTS;
  })();

  // Initialize reference from URL
  const initialRef = (() => {
    const raw = searchParams.get("ref") as DepartmentId | null;
    if (raw && initialDepts.includes(raw)) {
      return raw;
    }
    return initialDepts[0] ?? DEFAULT_REF;
  })();

  // Initialize cross-filters from URL
  const initialFilters = (() => {
    const filters: Filters = {};
    const minInc = searchParams.get("minIncome");
    const maxInc = searchParams.get("maxIncome");
    if (minInc || maxInc) {
      filters.income = {
        min: minInc ? parseFloat(minInc) : undefined,
        max: maxInc ? parseFloat(maxInc) : undefined,
      };
    }
    const edu = searchParams.get("education");
    if (edu) filters.educationIds = edu.split(",").filter(Boolean);
    const occ = searchParams.get("occupation");
    if (occ) filters.occupationIds = occ.split(",").filter(Boolean);
    const goal = searchParams.get("goal");
    if (goal) filters.goalIds = goal.split(",").filter(Boolean);
    return filters;
  })();

  const [selectedDepts, setSelectedDepts] = useState<DepartmentId[]>(initialDepts);
  const [referenceDept, setReferenceDept] = useState<DepartmentId>(initialRef);
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [activeBreakdown, setActiveBreakdown] = useState<"education" | "occupation" | "goal">("education");

  const [data, setData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(initialDepts.length >= 2);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state to URL
  const updateUrlParams = useCallback(
    (depts: DepartmentId[], ref: DepartmentId, f: Filters) => {
      const params = new URLSearchParams();
      params.set("depts", depts.join(","));
      params.set("ref", ref);

      if (f.income?.min !== undefined) params.set("minIncome", f.income.min.toString());
      if (f.income?.max !== undefined) params.set("maxIncome", f.income.max.toString());
      if (f.educationIds?.length) params.set("education", f.educationIds.join(","));
      if (f.occupationIds?.length) params.set("occupation", f.occupationIds.join(","));
      if (f.goalIds?.length) params.set("goal", f.goalIds.join(","));

      router.replace(`/comparador?${params.toString()}`, { scroll: false });
    },
    [router]
  );

  // Fetch comparison data from /api/compare
  const fetchComparisonData = useCallback(async () => {
    if (selectedDepts.length < 2) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Remove any territorial filter from cross-filters object
      const safeFilters = { ...filters };
      delete safeFilters.departmentIds;

      const bodyPayload = {
        departmentIds: selectedDepts,
        referenceDepartmentId: referenceDept,
        filters: Object.keys(safeFilters).length > 0 ? safeFilters : undefined,
        metrics: ALL_METRICS,
        breakdowns: ["education", "occupation", "goal"],
      };

      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}));
        throw new Error(errorJson?.error?.message ?? `Error en la solicitud: ${res.status}`);
      }

      const json: CompareResponse = await res.json();
      if (controller.signal.aborted) return;
      setData(json);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Ignore aborted requests
      }
      if (controller.signal.aborted) return;
      console.error("Fetch compare failed:", err);
      setError(err instanceof Error ? err.message : "Error al cargar los datos de comparación.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [selectedDepts, referenceDept, filters]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void fetchComparisonData();
    });
    return () => {
      active = false;
      abortControllerRef.current?.abort();
    };
  }, [fetchComparisonData]);

  // Department toggle handler
  function handleToggleDepartment(id: DepartmentId) {
    let nextDepts: DepartmentId[];
    if (selectedDepts.includes(id)) {
      nextDepts = selectedDepts.filter((d) => d !== id);
    } else {
      nextDepts = [...selectedDepts, id];
    }

    setSelectedDepts(nextDepts);
    const nextRef = id === referenceDept && nextDepts.length > 0 ? nextDepts[0] : referenceDept;

    // If removed department was the reference, auto-assign first remaining department
    if (id === referenceDept && nextDepts.length > 0) setReferenceDept(nextRef);
    if (nextDepts.length < 2) {
      abortControllerRef.current?.abort();
      setData(null);
      setLoading(false);
    } else setLoading(true);
    setError(null);
    updateUrlParams(nextDepts, nextRef, filters);
  }

  // Set reference handler
  function handleSetReference(id: DepartmentId) {
    if (!selectedDepts.includes(id)) {
      const nextDepts = [...selectedDepts, id];
      setSelectedDepts(nextDepts);
      setLoading(true);
      updateUrlParams(nextDepts, id, filters);
    } else {
      updateUrlParams(selectedDepts, id, filters);
    }
    setReferenceDept(id);
    setLoading(true);
    setError(null);
  }

  // Presets handler
  function handleSelectPresets(ids: DepartmentId[], newRef?: DepartmentId) {
    setSelectedDepts(ids);
    const nextRef = newRef && ids.includes(newRef) ? newRef : ids[0] ?? DEFAULT_REF;
    if (newRef && ids.includes(newRef)) {
      setReferenceDept(newRef);
    } else if (ids.length > 0) {
      setReferenceDept(nextRef);
    }
    setLoading(ids.length >= 2);
    setError(null);
    updateUrlParams(ids, nextRef, filters);
  }

  // Reset handler
  function handleReset() {
    setSelectedDepts(DEFAULT_DEPTS);
    setReferenceDept(DEFAULT_REF);
    setFilters({});
    setLoading(true);
    setError(null);
    updateUrlParams(DEFAULT_DEPTS, DEFAULT_REF, {});
  }

  function handleFilterChange(nextFilters: Filters) {
    setFilters(nextFilters);
    setLoading(true);
    setError(null);
    updateUrlParams(selectedDepts, referenceDept, nextFilters);
  }
  const explorerHref = `/explorador?${filterSearchParams(filters).toString()}`;
  const chatParams = filterSearchParams(filters);
  if (selectedDepts.length) chatParams.set("depts", selectedDepts.join(","));
  const chatHref = `/chat${chatParams.size ? `?${chatParams.toString()}` : ""}`;
  const reportHref = `/reportes${chatParams.size ? `?${chatParams.toString()}` : ""}`;

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Logo ImpactAtlas"
              width={140}
              height={36}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <nav className="hidden items-center gap-6 text-xs font-semibold text-zinc-600 md:flex">
            <Link href={explorerHref} className="transition-colors hover:text-[#002b7f]">
              Explorador y Mapa
            </Link>
            <span className="text-[#002b7f] font-bold border-b-2 border-[#002b7f] py-5">
              Comparador Departamental
            </span>
            <Link
              href={chatHref}
              className="transition-colors hover:text-[#002b7f]"
            >
              Chat Asistente
            </Link>
            <Link
              href={reportHref}
              className="transition-colors hover:text-[#002b7f]"
            >
              Reportes Ejecuto-Descargables
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href={explorerHref}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <BarChart3 className="size-3.5" />
              Ver Mapa
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative mx-auto w-full max-w-7xl flex-1 px-6 sm:px-8 py-8 space-y-6">
        <div className="absolute inset-0 bg-tech-grid opacity-30 pointer-events-none" />

        {/* Title Header */}
        <div className="relative flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50/70 px-3.5 py-1 text-xs font-semibold text-[#ff6a00] shadow-2xs">
              <GitCompare className="size-3.5 text-[#ff6a00]" />
              <span className="font-mono text-[11px] tracking-wide uppercase">MATRIZ TERRITORIAL · ANÁLISIS DE BRECHAS</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-zinc-950 sm:text-3xl">
              Comparador Territorial de Brechas
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-zinc-600 max-w-3xl leading-relaxed">
              Contraste multidimensional entre departamentos con base de referencia dinámica. Las brechas se calculan en dólares ($ USD) y puntos porcentuales (pp), garantizando comparaciones rigurosas sin sesgos relativos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {loading && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-[#002b7f] animate-pulse">
                <Loader2 className="size-3 animate-spin" />
                Actualizando cálculos...
              </span>
            )}
          </div>
        </div>

        {/* 1. Department Selection and Reference Panel */}
        <DepartmentSelector
          selectedIds={selectedDepts}
          referenceId={referenceDept}
          onToggleDepartment={handleToggleDepartment}
          onSetReference={handleSetReference}
          onSelectPresets={handleSelectPresets}
          onReset={handleReset}
        />

        {/* 2. Population & Cross-Filters */}
        <FilterBar
          filters={filters}
          onChangeFilters={handleFilterChange}
          sampleSize={data?.meta?.sampleSize ?? null}
          loading={loading}
        />

        {/* 3. Error Alert */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Error en la comparación:</span>
              <p>{error}</p>
              <button
                type="button"
                onClick={fetchComparisonData}
                className="mt-2 inline-flex items-center gap-1 rounded bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 transition-colors"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* 4. Validation Guidance if < 2 Departments */}
        {selectedDepts.length < 2 && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <GitCompare className="size-6" />
            </div>
            <h3 className="text-base font-bold text-zinc-900">
              Se requieren al menos 2 departamentos
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
              Para calcular brechas relativas y matrices de comparación territoriales, seleccione dos o más departamentos en el panel superior.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleSelectPresets(DEFAULT_DEPTS, DEFAULT_REF)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#002b7f] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#002060] transition-colors"
              >
                Cargar San Salvador vs Santa Ana
              </button>
            </div>
          </div>
        )}

        {/* 5. Comparison Results */}
        {selectedDepts.length >= 2 && data && (
          <div className="space-y-6">
            {/* KPI Cards and Comparative Matrix Table */}
            <ComparisonTable
              departments={data.data.departments}
              referenceId={referenceDept}
              selectedMetrics={ALL_METRICS}
              onSetReference={handleSetReference}
            />

            {/* Categorical Breakdown Comparison */}
            <BreakdownComparison
              departments={data.data.departments}
              referenceId={referenceDept}
              activeBreakdown={activeBreakdown}
              onChangeBreakdown={setActiveBreakdown}
            />

            {/* Methodological Context Footer */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-600 space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                <span className="font-bold text-zinc-900 uppercase tracking-wide">
                  Metodología de Comparación y Transparencia
                </span>
                <span className="text-[11px] font-mono text-zinc-400">
                  ID Petición: {data.meta.requestId.slice(0, 8)} • Muestra: {data.meta.sampleSize?.toLocaleString()}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-zinc-500">
                <div>
                  <strong className="text-zinc-800">Cálculo en Servidor:</strong> Todas las diferencias y agregaciones se procesan en PostgreSQL sin aproximaciones ni redondeos acumulados en el cliente.
                </div>
                <div>
                  <strong className="text-zinc-800">Puntos Porcentuales:</strong> Las variaciones de tasas (como exclusión financiera o escolaridad) se expresan en puntos porcentuales (pp) para evitar el sesgo de restas relativas.
                </div>
                <div>
                  <strong className="text-zinc-800">Supresión de Privacidad:</strong> Si una cohorte departamental o categoría cuenta con menos de 5 registros ($n &lt; 5$), sus datos y diferencias asociadas se omiten para evitar reidentificación.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Futuristic Site Footer */}
      <SiteFooter />
    </div>
  );
}

export default function ComparadorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#002b7f]">
            <Loader2 className="size-4 animate-spin" />
            Cargando comparador...
          </div>
        </div>
      }
    >
      <ComparadorRoute />
    </Suspense>
  );
}

function ComparadorRoute() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return <ComparadorContent key={query} query={query} />;
}
