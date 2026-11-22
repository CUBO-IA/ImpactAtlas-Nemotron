"use client";

import React, { Suspense, useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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

function ExploradorContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Navigation / View mode: map view vs table view
  const [viewMode, setViewMode] = useState<"map" | "table">("map");

  // Selected Department (null = All El Salvador)
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentId | null>(null);

  // Active Map Metric for choropleth scale
  const [activeMetric, setActiveMetric] = useState<ActiveMapMetric>("financial_exclusion_pct");

  // Filters State
  const [filters, setFilters] = useState<Filters>({});

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

  // Sync state from URL on initial mount
  useEffect(() => {
    const dept = searchParams.get("dept") as DepartmentId | null;
    const minStr = searchParams.get("min");
    const maxStr = searchParams.get("max");
    const edu = searchParams.get("edu");
    const occ = searchParams.get("occ");
    const goal = searchParams.get("goal");

    const initialFilters: Filters = {};
    if (minStr || maxStr) {
      initialFilters.income = {
        min: minStr ? parseFloat(minStr) : undefined,
        max: maxStr ? parseFloat(maxStr) : undefined,
      };
    }
    if (edu) initialFilters.educationIds = [edu];
    if (occ) initialFilters.occupationIds = [occ];
    if (goal) initialFilters.goalIds = [goal];

    if (dept) setSelectedDepartment(dept);
    setFilters(initialFilters);
  }, [searchParams]);

  // Sync state to URL
  const updateUrl = useCallback((nextFilters: Filters, nextDept: DepartmentId | null) => {
    const params = new URLSearchParams();
    if (nextDept) params.set("dept", nextDept);
    if (nextFilters.income?.min !== undefined) params.set("min", String(nextFilters.income.min));
    if (nextFilters.income?.max !== undefined) params.set("max", String(nextFilters.income.max));
    if (nextFilters.educationIds?.[0]) params.set("edu", nextFilters.educationIds[0]);
    if (nextFilters.occupationIds?.[0]) params.set("occ", nextFilters.occupationIds[0]);
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

    setLoading(true);
    setError(null);

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
      setSampleSize(deptJson.meta?.sampleSize ?? 0);

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
      setLoading(false);
    }
  }, [filters, selectedDepartment]);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  function handleFilterChange(nextFilters: Filters) {
    setFilters(nextFilters);
    updateUrl(nextFilters, selectedDepartment);
  }

  function handleDepartmentSelect(dept: DepartmentId | null) {
    setSelectedDepartment(dept);
    updateUrl(filters, dept);
  }

  // Current metrics for the detail panel
  const currentDeptMetrics = selectedDepartment
    ? departmentData.get(selectedDepartment)
    : undefined;

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50/50 text-zinc-900 selection:bg-orange-500 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 border-b border-zinc-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="ImpactAtlas Logo"
              width={150}
              height={50}
              priority
              className="h-9 w-auto object-contain"
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-zinc-600 md:flex">
            <Link
              href="/explorador"
              className="font-bold text-[#002b7f] border-b-2 border-[#002b7f] pb-1"
            >
              Explorador y Mapa
            </Link>
            <Link href="/#comparador" className="transition-colors hover:text-[#002b7f]">
              Comparador
            </Link>
            <Link href="/#chat" className="transition-colors hover:text-[#002b7f]">
              Asistente IA
            </Link>
            <Link href="/#reportes" className="transition-colors hover:text-[#002b7f]">
              Reportes PDF
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              Volver al Inicio
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-6 sm:px-8 py-8 space-y-6">
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[#002b7f] mb-2">
              <LineChart className="size-3.5" />
              <span>Explorador Territorial e Indicadores Socioeconómicos</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
              Mapeo de Inclusión Financiera en El Salvador
            </h1>
            <p className="text-sm text-zinc-600 mt-1 max-w-2xl">
              Analiza los 14 departamentos, compara métricas de exclusión y descubre las prioridades de desarrollo según nivel educativo e ingreso.
            </p>
          </div>

          {/* View toggle (Map vs Accessible Table) */}
          <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 text-xs font-semibold shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                viewMode === "map"
                  ? "bg-[#002b7f] text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <MapIcon className="size-3.5" />
              Mapa Coroplético
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                viewMode === "table"
                  ? "bg-[#002b7f] text-white shadow-xs"
                  : "text-zinc-600 hover:text-zinc-950"
              }`}
            >
              <TableIcon className="size-3.5" />
              Vista Tabular
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
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-600 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                <HelpCircle className="size-3.5 text-[#002b7f]" />
                <span>Metodología de Visualización</span>
              </div>
              <p className="leading-relaxed text-[11px] text-zinc-500">
                Los colores del mapa representan la intensidad del indicador seleccionado calculada sobre 50,000 perfiles socioeconómicos.
                Las submuestras con menos de 5 observaciones aplican reglas de supresión para resguardar la privacidad.
              </p>
            </div>
          </div>

          {/* Right Column: Statistics & Detail Panel (5 columns on desktop) */}
          <div className="lg:col-span-5">
            <DetailPanel
              selectedDepartment={selectedDepartment}
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

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-8 mt-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-zinc-500 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="ImpactAtlas"
              width={110}
              height={36}
              className="h-6 w-auto object-contain opacity-80"
            />
            <span className="text-zinc-300">|</span>
            <span>Explorador Territorial de El Salvador</span>
          </div>
          <p className="text-zinc-400">
            ImpactAtlas • Mapeo Estadístico e Inclusión Financiera
          </p>
        </div>
      </footer>
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
      <ExploradorContent />
    </Suspense>
  );
}
