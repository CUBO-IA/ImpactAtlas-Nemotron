"use client";

import React, { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import type { Filters } from "@/src/contracts/common";
import { FilterBar } from "@/components/filters/filter-bar";
import { ReportConfigurator } from "@/components/reports/report-configurator";
import { FileText, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";

function ReportesContent() {
  const searchParams = useSearchParams();

  // Read filters from URL if present
  const initialFilters = React.useMemo(() => {
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
  }, [searchParams]);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const activeFiltersCount =
    (filters.departmentIds?.length ?? 0) +
    (filters.income?.min !== undefined || filters.income?.max !== undefined ? 1 : 0) +
    (filters.educationIds?.length ?? 0) +
    (filters.occupationIds?.length ?? 0) +
    (filters.goalIds?.length ?? 0);

  return (
    <div className="flex flex-col min-h-screen bg-white text-zinc-900 selection:bg-[#ff6a00] selection:text-white relative font-sans">
      {/* Futuristic Site Header */}
      <SiteHeader />

      {/* Main Content */}
      <main className="relative mx-auto w-full max-w-5xl flex-1 px-6 sm:px-8 py-8 space-y-6">
        <div className="absolute inset-0 bg-tech-dots opacity-30 pointer-events-none" />

        {/* Title Header */}
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200/60 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-200/80 bg-orange-50/70 px-3.5 py-1 text-xs font-semibold text-[#ff6a00] mb-1.5 shadow-2xs">
              <FileText className="size-3.5 text-[#ff6a00]" />
              <span className="font-mono text-[11px] tracking-wide uppercase">EMISIÓN OFICIAL DE INFORMES PDF · CHROMIUM ENGINE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950">
              Generador de Reportes Ejecutivos
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 mt-1 max-w-2xl leading-relaxed">
              Configura los indicadores, desgloses demográficos y secciones analíticas. Los documentos se compilan íntegramente en el servidor con motor Chromium headless y gráficos vectoriales SVG.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold transition-all shadow-2xs self-start sm:self-auto ${
              activeFiltersCount > 0
                ? "border-[#002b7f] bg-blue-50/80 text-[#002b7f]"
                : "border-zinc-200/80 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
            }`}
          >
            <SlidersHorizontal className="size-3.5 text-[#ff6a00]" />
            <span>Filtros del Reporte</span>
            {activeFiltersCount > 0 && (
              <span className="size-4 rounded-full bg-[#002b7f] text-[10px] text-white flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="size-3.5 text-zinc-400" /> : <ChevronDown className="size-3.5 text-zinc-400" />}
          </button>
        </div>

        {/* Collapsible Filter Bar */}
        {showFilters && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <FilterBar
              filters={filters}
              onChangeFilters={setFilters}
              sampleSize={null}
              loading={false}
            />
          </div>
        )}

        {/* Report Configurator */}
        <ReportConfigurator filters={filters} />
      </main>

      {/* Futuristic Site Footer */}
      <SiteFooter />
    </div>
  );
}

export default function ReportesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#002b7f]">
            <FileText className="size-4 animate-bounce" />
            Cargando configurador de reportes...
          </div>
        </div>
      }
    >
      <ReportesContent />
    </Suspense>
  );
}
