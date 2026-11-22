"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { DepartmentId, MetricValue } from "@/src/contracts/common";
import { DEPARTMENTS } from "@/src/lib/catalog-data";
import {
  Users,
  DollarSign,
  TrendingUp,
  GraduationCap,
  Briefcase,
  Target,
  AlertTriangle,
  Info,
  GitCompare,
} from "lucide-react";

interface StatisticsRow {
  key: string;
  label: string;
  sampleSize: number | null;
  metrics: Partial<Record<string, MetricValue>>;
}

interface DetailPanelProps {
  selectedDepartment: DepartmentId | null;
  departmentMetrics?: Record<string, MetricValue>;
  educationRows: StatisticsRow[];
  occupationRows: StatisticsRow[];
  goalRows: StatisticsRow[];
  loading: boolean;
  sampleSize: number | null;
}

export function DetailPanel({
  selectedDepartment,
  departmentMetrics,
  educationRows,
  occupationRows,
  goalRows,
  loading,
  sampleSize,
}: DetailPanelProps) {
  const [breakdownTab, setBreakdownTab] = useState<"education" | "occupation" | "goal">("education");

  const deptObj = selectedDepartment
    ? DEPARTMENTS.find((d) => d.id === selectedDepartment)
    : null;

  const title = deptObj ? deptObj.label : "El Salvador (Nivel Nacional)";

  // Formatters
  const sampleCount = departmentMetrics?.sample_count?.value ?? sampleSize;
  const incomeMean = departmentMetrics?.income_mean?.value;
  const incomeMedian = departmentMetrics?.income_median?.value;
  const exclusionPct = departmentMetrics?.financial_exclusion_pct?.value;
  const isSuppressed = departmentMetrics?.financial_exclusion_pct?.suppressed;

  const activeRows =
    breakdownTab === "education"
      ? educationRows
      : breakdownTab === "occupation"
      ? occupationRows
      : goalRows;

  // Sort rows descending by category_pct or category_count
  const sortedRows = [...activeRows].sort((a, b) => {
    const valA = a.metrics?.category_pct?.value ?? 0;
    const valB = b.metrics?.category_pct?.value ?? 0;
    return valB - valA;
  });

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs flex flex-col gap-6">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#002b7f]" />
            <h3 className="text-lg font-bold text-zinc-950">{title}</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {selectedDepartment
              ? "Detalle estadístico para el departamento seleccionado."
              : "Consolidado nacional de los 14 departamentos con los filtros activos."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedDepartment && (
            <Link
              href={`/comparador?depts=${selectedDepartment},san-salvador&ref=${selectedDepartment}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-[#002b7f] hover:text-[#002b7f] hover:bg-white transition-all shadow-2xs"
            >
              <GitCompare className="size-3.5 text-[#ff6a00]" />
              Comparar este departamento
            </Link>
          )}

          {isSuppressed && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
              <AlertTriangle className="size-3.5" />
              Muestra insuficiente (&lt; 5) — Datos suprimidos
            </div>
          )}
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Card 1: Sample Size */}
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Muestra (n)</span>
            <Users className="size-4 text-[#002b7f]" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">
            {loading ? (
              <span className="inline-block w-16 h-6 bg-zinc-200 rounded animate-pulse" />
            ) : isSuppressed ? (
              <span className="text-sm font-semibold text-zinc-400">Suprimido</span>
            ) : (
              (sampleCount ?? 0).toLocaleString()
            )}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">Perfiles analizados</div>
        </div>

        {/* Card 2: Income Mean */}
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Ingreso Medio</span>
            <DollarSign className="size-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">
            {loading ? (
              <span className="inline-block w-16 h-6 bg-zinc-200 rounded animate-pulse" />
            ) : incomeMean !== null && incomeMean !== undefined ? (
              `$${incomeMean.toFixed(0)}`
            ) : (
              "—"
            )}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">USD mensual est.</div>
        </div>

        {/* Card 3: Income Median */}
        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Ingreso Mediano</span>
            <DollarSign className="size-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-zinc-950">
            {loading ? (
              <span className="inline-block w-16 h-6 bg-zinc-200 rounded animate-pulse" />
            ) : incomeMedian !== null && incomeMedian !== undefined ? (
              `$${incomeMedian.toFixed(0)}`
            ) : (
              "—"
            )}
          </div>
          <div className="text-[10px] text-zinc-400 mt-1">Percentil 50</div>
        </div>

        {/* Card 4: Financial Exclusion */}
        <div className="rounded-2xl border border-zinc-100 bg-orange-50/50 p-4">
          <div className="flex items-center justify-between text-orange-400 mb-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-orange-700">Sin Acceso Fin.</span>
            <TrendingUp className="size-4 text-[#ff6a00]" />
          </div>
          <div className="text-2xl font-bold text-[#ff6a00]">
            {loading ? (
              <span className="inline-block w-16 h-6 bg-orange-200 rounded animate-pulse" />
            ) : exclusionPct !== null && exclusionPct !== undefined ? (
              `${exclusionPct.toFixed(1)}%`
            ) : (
              "—"
            )}
          </div>
          <div className="text-[10px] text-orange-600/80 mt-1">Tasa de exclusión</div>
        </div>
      </div>

      {/* Breakdown Distributions */}
      <div className="pt-2">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3 mb-4">
          <h4 className="text-sm font-bold text-zinc-900">Distribución Poblacional</h4>
          <div className="inline-flex rounded-xl bg-zinc-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => setBreakdownTab("education")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                breakdownTab === "education"
                  ? "bg-white font-semibold text-[#002b7f] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <GraduationCap className="size-3.5" />
              Educación
            </button>
            <button
              type="button"
              onClick={() => setBreakdownTab("occupation")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                breakdownTab === "occupation"
                  ? "bg-white font-semibold text-[#002b7f] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Briefcase className="size-3.5" />
              Ocupación
            </button>
            <button
              type="button"
              onClick={() => setBreakdownTab("goal")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all ${
                breakdownTab === "goal"
                  ? "bg-white font-semibold text-[#ff6a00] shadow-xs"
                  : "text-zinc-600 hover:text-zinc-900"
              }`}
            >
              <Target className="size-3.5" />
              Metas
            </button>
          </div>
        </div>

        {/* Breakdown Content List / Bars */}
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between">
                    <span className="w-28 h-3.5 bg-zinc-200 rounded animate-pulse" />
                    <span className="w-12 h-3.5 bg-zinc-200 rounded animate-pulse" />
                  </div>
                  <div className="w-full h-2.5 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-200 animate-pulse" style={{ width: `${60 - i * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedRows.length === 0 || (sampleCount === 0) ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No hay observaciones para este desglose con los filtros actuales.
            </div>
          ) : (
            sortedRows.map((row) => {
              const pct = row.metrics?.category_pct?.value ?? 0;
              const count = row.metrics?.category_count?.value ?? row.sampleSize ?? 0;
              const suppressed = row.metrics?.category_pct?.suppressed;

              return (
                <div key={row.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-800 truncate max-w-[70%]">
                      {row.label}
                    </span>
                    <span className="font-mono text-xs text-zinc-600">
                      {suppressed ? (
                        <span className="text-[10px] text-amber-600 italic">(&lt;5)</span>
                      ) : (
                        `${pct.toFixed(1)}% (${count.toLocaleString()})`
                      )}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        breakdownTab === "goal" ? "bg-[#ff6a00]" : "bg-[#002b7f]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Methodological footnote */}
      <div className="mt-auto pt-3 border-t border-zinc-100 flex items-center gap-2 text-[11px] text-zinc-400">
        <Info className="size-3.5 shrink-0 text-zinc-400" />
        <span>Métricas calculadas exactamente sobre los registros en PostgreSQL mediante agregaciones SQL seguras.</span>
      </div>
    </div>
  );
}
