"use client";

import React, { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import { SvChoroplethMap, type ActiveMapMetric } from "@/components/map/sv-choropleth-map";
import { FilterBar } from "@/components/filters/filter-bar";
import { DetailPanel } from "@/components/statistics/detail-panel";
import { DepartmentTable } from "@/components/map/department-table";
import type { DepartmentId, Filters, MetricValue } from "@/src/contracts/common";
import {
  LineChart,
  Table as TableIcon,
  Map as MapIcon,
  AlertCircle,
  HelpCircle,
} from "lucide-react";

interface StatisticsRow {
  key: string;
  label: string;
  sampleSize: number | null;
  metrics: Partial<Record<string, MetricValue>>;
}

function ExploradorContent({ query }: { query: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = new URLSearchParams(query);

  // Navigation / View mode: map view vs table view
  const [viewMode, setViewMode] = useState<"map" | "table">("map");

  // Selected Department (null = All El Salvador)
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentId | null>(
    searchParams.get("dept") as DepartmentId | null,
  );

  // Active Map Metric for choropleth scale
  const [activeMetric, setActiveMetric] = useState<ActiveMapMetric>("financial_exclusion_pct");

  // Filters State
  const [filters, setFilters] = useState<Filters>(() => {
    const initial: Filters = {};
    const min = searchParams.get("minIncome") ?? searchParams.get("min");
    const max = searchParams.get("maxIncome") ?? searchParams.get("max");
    const education = searchParams.get("education") ?? searchParams.get("edu");
    const occupation = searchParams.get("occupation") ?? searchParams.get("occ");
    const goal = searchParams.get("goal");
    if (min || max) initial.income = { min: min ? Number(min) : undefined, max: max ? Number(max) : undefined };
    if (education) initial.educationIds = education.split(",").filter(Boolean);
    if (occupation) initial.occupationIds = occupation.split(",").filter(Boolean);
    if (goal) initial.goalIds = goal.split(",").filter(Boolean);
    return initial;
  });

  // Data States
  const [departmentData, setDepartmentData] = useState<Map<string, Record<string, MetricValue>>>(new Map());
  const [educationRows, setEducationRows] = useState<StatisticsRow[]>([]);
  const [occupationRows, setOccupationRows] = useState<StatisticsRow[]>([]);
  const [goalRows, setGoalRows] = useState<StatisticsRow[]>([]);
  const [sampleSize, setSampleSize] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // AbortController ref to prevent stale response race conditions (D1-06)
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state to URL
  const updateUrl = useCallback((nextFilters: Filters, nextDept: DepartmentId | null) => {
    const params = new URLSearchParams();
    if (nextDept) params.set("dept", nextDept);
    if (nextFilters.income?.min !== undefined) params.set("minIncome", String(nextFilters.income.min));
    if (nextFilters.income?.max !== undefined) params.set("maxIncome", String(nextFilters.income.max));
    if (nextFilters.educationIds?.[0]) params.set("education", nextFilters.educationIds[0]);
    if (nextFilters.occupationIds?.[0]) params.set("occupation", nextFilters.occupationIds[0]);
    if (nextFilters.goalIds?.[0]) params.set("goal", nextFilters.goalIds[0]);

    const newQuery = params.toString();
    router.replace(`${pathname}${newQuery ? `?${newQuery}` : ""}`, { scroll: false });
  }, [pathname, router]);

  // Fetch statistics from API with AbortController guard
  const fetchStatistics = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const queryFilters: Filters = { ...filters };
    if (selectedDepartment) {
      queryFilters.departmentIds = [selectedDepartment];
    }

    try {
      // 1. Fetch Department statistics for Map and KPI cards
      const deptReq = fetch("/api/statistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters, // All departments for map, unconstrained by selectedDepartment
          groupBy: "department",
          metrics: ["sample_count", "income_mean", "income_median", "financial_exclusion_pct"],
        }),
        signal: controller.signal,
      });

      // 2. Fetch Education breakdown for selected cohort
      const eduReq = fetch("/api/statistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: queryFilters,
          groupBy: "education",
          metrics: ["category_count", "category_pct"],
        }),
        signal: controller.signal,
      });

      // 3. Fetch Occupation breakdown for selected cohort
      const occReq = fetch("/api/statistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: queryFilters,
          groupBy: "occupation",
          metrics: ["category_count", "category_pct"],
        }),
        signal: controller.signal,
      });

      // 4. Fetch Goal breakdown for selected cohort
      const goalReq = fetch("/api/statistics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filters: queryFilters,
          groupBy: "goal",
          metrics: ["category_count", "category_pct"],
        }),
        signal: controller.signal,
      });

      const [deptRes, eduRes, occRes, goalRes] = await Promise.all([
        deptReq,
        eduReq,
        occReq,
        goalReq,
      ]);

      if (!deptRes.ok || !eduRes.ok || !occRes.ok || !goalRes.ok) {
        throw new Error("Uno o más servicios estadísticos respondieron con error.");
      }

      const deptJson = await deptRes.json();
      const eduJson = await eduRes.json();
      const occJson = await occRes.json();
      const goalJson = await goalRes.json();

      // Transform department data into lookup Map
      const dMap = new Map<string, Record<string, MetricValue>>();
      for (const row of deptJson.data.rows) {
        dMap.set(row.key, row.metrics);
      }
      setDepartmentData(dMap);
      setSampleSize(deptJson.meta?.sampleSize ?? null);

      setEducationRows(eduJson.data?.rows ?? []);
      setOccupationRows(occJson.data?.rows ?? []);
      setGoalRows(goalJson.data?.rows ?? []);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return; // Ignore aborted requests
      }
      console.error("Failed to load statistics:", err);
      setError("No se pudieron cargar las estadísticas. Verifica la conexión con el servidor.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [filters, selectedDepartment]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void fetchStatistics();
    });
    return () => {
      active = false;
      abortControllerRef.current?.abort();
    };
  }, [fetchStatistics]);

  function handleFilterChange(nextFilters: Filters) {
    setLoading(true);
    setError(null);
    setFilters(nextFilters);
    updateUrl(nextFilters, selectedDepartment);
  }

  function handleDepartmentSelect(dept: DepartmentId | null) {
    setLoading(true);
    setError(null);
    setSelectedDepartment(dept);
    updateUrl(filters, dept);
  }

  // Current metrics for the detail panel
  const currentDeptMetrics = selectedDepartment
    ? departmentData.get(selectedDepartment)
    : undefined;
  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 selection:bg-[#ff6a00] selection:text-white relative">
      {/* Futuristic Site Header */}
      <SiteHeader />

      <main className="relative flex-1 mx-auto w-full max-w-7xl px-6 sm:px-8 py-8 space-y-6">
        <div className="absolute inset-0 bg-tech-grid opacity-30 pointer-events-none" />
        {/* Title Header */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/70 px-3.5 py-1 text-xs font-semibold text-[#002b7f] mb-2 shadow-2xs">
              <LineChart className="size-3.5 text-[#ff6a00]" />
              <span className="font-mono text-[11px] tracking-wide">CARTOGRAFÍA SOCIOECONÓMICA · EL SALVADOR</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
              Explorador Territorial de Inclusión Financiera
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-2xl leading-relaxed">
              Analiza los 14 departamentos, evalúa brechas de exclusión y descubre las prioridades de desarrollo según nivel educativo e ingreso.
            </p>
          </div>

          {/* View toggle (Map vs Accessible Table) */}
          <div className="inline-flex rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-1 text-xs font-semibold shadow-2xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all duration-200 ${
                viewMode === "map"
                  ? "bg-[#002b7f] text-white shadow-xs font-bold"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-white/50"
              }`}
            >
              <MapIcon className="size-3.5" />
              <span>Mapa Coroplético</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 transition-all duration-200 ${
                viewMode === "table"
                  ? "bg-[#002b7f] text-white shadow-xs font-bold"
                  : "text-zinc-600 hover:text-zinc-950 hover:bg-white/50"
              }`}
            >
              <TableIcon className="size-3.5" />
              <span>Vista Tabular</span>
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Filter Bar */}
        <FilterBar
          filters={filters}
          onChangeFilters={handleFilterChange}
          sampleSize={sampleSize}
          loading={loading}
          incomeDebounceMs={300}
        />

        {/* 2-Column Responsive Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Map or Table (7 columns on desktop) */}
          <div className="lg:col-span-7 space-y-6">
            {viewMode === "map" ? (
              <SvChoroplethMap
                data={departmentData}
                selectedDepartment={selectedDepartment}
                onSelectDepartment={handleDepartmentSelect}
                activeMetric={activeMetric}
                onChangeMetric={setActiveMetric}
              />
            ) : (
              <DepartmentTable
                data={departmentData}
                selectedDepartment={selectedDepartment}
                onSelectDepartment={handleDepartmentSelect}
              />
            )}

            {/* Methodological Context Note */}
            <div className="glass-surface rounded-2xl p-5 text-xs text-zinc-600 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <HelpCircle className="size-3.5 text-[#002b7f]" />
                <span>Metodología de Visualización Geoespacial</span>
              </div>
              <p className="leading-relaxed text-[11px] text-zinc-500">
                Los colores representan el indicador seleccionado para el corte disponible. La muestra puede variar con los filtros;
                Las submuestras con menos de 5 observaciones aplican reglas de supresión para resguardar la privacidad.
              </p>
            </div>
          </div>

          {/* Right Column: Statistics & Detail Panel (5 columns on desktop) */}
          <div className="lg:col-span-5">
            <DetailPanel
              selectedDepartment={selectedDepartment}
              filters={filters}
              departmentMetrics={currentDeptMetrics}
              educationRows={educationRows}
              occupationRows={occupationRows}
              goalRows={goalRows}
              loading={loading}
              sampleSize={sampleSize}
            />
          </div>
        </div>
      </main>

      {/* Futuristic Site Footer */}
      <SiteFooter />
    </div>
  );
}

export default function ExploradorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-white text-zinc-500">
          <div className="flex items-center gap-3">
            <div className="size-4 animate-spin rounded-full border-2 border-[#002b7f] border-t-transparent" />
            <span className="text-xs font-semibold">Cargando Explorador...</span>
          </div>
        </div>
      }
    >
      <ExploradorRoute />
    </Suspense>
  );
}

function ExploradorRoute() {
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  return <ExploradorContent key={query} query={query} />;
}
