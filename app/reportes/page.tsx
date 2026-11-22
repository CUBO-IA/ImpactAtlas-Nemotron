"use client";

import React, { Suspense, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 flex flex-col font-sans">
      {/* Header */}
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
            <Link href="/explorador" className="transition-colors hover:text-[#002b7f]">
              Explorador y Mapa
            </Link>
            <Link href="/comparador" className="transition-colors hover:text-[#002b7f]">
              Comparador Departamental
            </Link>
            <Link href="/chat" className="transition-colors hover:text-[#002b7f]">
              Chat Asistente IA
            </Link>
            <Link
              href="/reportes"
              className="text-[#002b7f] font-bold border-b-2 border-[#002b7f] py-5"
            >
              Reportes PDF
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                activeFiltersCount > 0
                  ? "border-[#002b7f] bg-blue-50 text-[#002b7f]"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span>Filtros del Reporte</span>
              {activeFiltersCount > 0 && (
                <span className="size-4 rounded-full bg-[#002b7f] text-[10px] text-white flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 space-y-6">
        {/* Title Header */}
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#ff6a00]">
            <FileText className="size-3.5" />
            Emisión de Informes Oficiales en PDF
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl">
            Generador de Reportes Ejecutivos
          </h1>
          <p className="mt-1 text-xs text-zinc-600 max-w-3xl">
            Configura los indicadores, desgloses demográficos y secciones analíticas. Los documentos se compilan íntegramente en el servidor con motor Chromium headless y gráficos vectoriales SVG, garantizando consistencia y fidelidad visual.
          </p>
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

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 mt-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Logo ImpactAtlas"
              width={100}
              height={26}
              className="h-6 w-auto object-contain opacity-80"
            />
            <span className="text-xs text-zinc-400">|</span>
            <span className="text-xs text-zinc-500">ImpactAtlas — Generador de Documentos Oficiales</span>
          </div>
          <p className="text-xs text-zinc-400">
            El Salvador • Análisis Socioeconómico y Visualización con Inteligencia Artificial
          </p>
        </div>
      </footer>
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
