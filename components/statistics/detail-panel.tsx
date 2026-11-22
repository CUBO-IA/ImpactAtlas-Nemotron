"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { DepartmentId, Filters, MetricValue } from "@/src/contracts/common";
import { DEPARTMENTS } from "@/src/lib/catalog-data";
import { filterSearchParams } from "@/src/lib/filter-url";
import {
  Users,
  DollarSign,
  TrendingUp,
  GraduationCap,
  Briefcase,
  Target,
  AlertTriangle,
  GitCompare,
  ArrowRight,
} from "lucide-react";

interface StatisticsRow {
  key: string;
  label: string;
  sampleSize: number | null;
  metrics: Partial<Record<string, MetricValue>>;
}

interface DetailPanelProps {
  selectedDepartment: DepartmentId | null;
  filters: Filters;
  departmentMetrics?: Record<string, MetricValue>;
  educationRows: StatisticsRow[];
  occupationRows: StatisticsRow[];
  goalRows: StatisticsRow[];
  loading: boolean;
  sampleSize: number | null;
}

export function DetailPanel({
  selectedDepartment,
  filters,
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
    const valA = a.metrics?.category_pct?.value ?? -1;
    const valB = b.metrics?.category_pct?.value ?? -1;
    return valB - valA;
  });

  return (
    <div className="glass-surface hud-bracket rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col gap-5">
      {/* Panel Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#002b7f] animate-pulse" />
            <h3 className="text-lg font-extrabold text-zinc-950">{title}</h3>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            {selectedDepartment
              ? "Telemetría estadística detallada para el departamento seleccionado."
              : "Consolidado nacional de los 14 departamentos con los filtros activos."}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {selectedDepartment && (
            <Link
              href={`/comparador?${(() => {
                const params = filterSearchParams(filters);
                params.set("depts", [selectedDepartment, selectedDepartment === "san-salvador" ? "santa-ana" : "san-salvador"].join(","));
                params.set("ref", selectedDepartment);
                return params.toString();
              })()}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:border-[#002b7f] hover:text-[#002b7f] hover:bg-white transition-all shadow-2xs"
            >
              <GitCompare className="size-3.5 text-[#ff6a00] transition-transform group-hover:rotate-180 duration-500" />
              <span>Comparar este departamento</span>
              <ArrowRight className="size-3 text-zinc-400 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          )}

          {isSuppressed && (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50/90 px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200/80 shadow-2xs">
              <AlertTriangle className="size-3.5 text-amber-600" />
              <span>Muestra insuficiente ($n &lt; 5$) — Datos protegidos</span>
            </div>
          )}
        </div>
      </div>

      {/* Resumen de indicadores */}
      <div className="grid grid-cols-2 gap-3">
        <div className="relative overflow-hidden rounded-xl border border-blue-200/70 bg-blue-50/30 p-4">
          <div className="h-1 w-full bg-[#002b7f] absolute top-0 left-0" />
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-950">Ingreso medio</span>
            <DollarSign className="size-4 text-[#002b7f]" />
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-950 tracking-tight">
            {loading ? (
              <span className="inline-block w-20 h-7 bg-zinc-200 rounded animate-pulse" />
            ) : typeof incomeMean === "number" ? (
              `$${incomeMean.toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ) : (
              "—"
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1.5">
            Promedio estimado · USD
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
          <div className="h-1 w-full bg-zinc-400 absolute top-0 left-0" />
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-700">Ingreso mediano</span>
            <DollarSign className="size-4 text-zinc-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-950 tracking-tight">
            {loading ? (
              <span className="inline-block w-20 h-7 bg-zinc-200 rounded animate-pulse" />
            ) : typeof incomeMedian === "number" ? (
              `$${incomeMedian.toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ) : (
              "—"
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1.5">
            Percentil 50 · USD
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
          <div className="h-1 w-full bg-emerald-500 absolute top-0 left-0" />
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-700">Muestra activa</span>
            <Users className="size-4 text-emerald-600" />
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-950 tracking-tight">
            {loading ? (
              <span className="inline-block w-16 h-7 bg-zinc-200 rounded animate-pulse" />
            ) : isSuppressed ? (
              <span className="text-sm font-sans text-zinc-400">Suprimida</span>
            ) : typeof sampleCount === "number" ? (
              sampleCount.toLocaleString()
            ) : (
              "—"
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1.5">
            Perfiles analizados
          </p>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <div className="h-1 w-full bg-[#ff6a00] absolute top-0 left-0" />
          <div className="flex items-center justify-between text-xs text-orange-700 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide">Sin acceso financiero</span>
            <TrendingUp className="size-4 text-[#ff6a00]" />
          </div>
          <div className="font-mono text-2xl font-bold text-zinc-950 tracking-tight">
            {loading ? (
              <span className="inline-block w-16 h-7 bg-zinc-200 rounded animate-pulse" />
            ) : isSuppressed ? (
              <span className="text-xs font-sans text-zinc-400">Suprimido</span>
            ) : typeof exclusionPct === "number" ? (
              `${exclusionPct.toFixed(1)}%`
            ) : (
              "—"
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1.5">
            Sin cuenta bancaria ni servicios formales
          </p>
        </div>
      </div>

      {/* Categorical Distribution Section */}
      <div className="space-y-4 border-t border-zinc-200 pt-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h4 className="text-sm font-extrabold text-zinc-950">Distribución Socioeconómica</h4>
            <p className="text-[11px] text-zinc-500">
              Desglose porcentual y tasa de exclusión financiera segmentada.
            </p>
          </div>

          {/* Breakdown Tabs */}
          <div className="inline-flex rounded-xl border border-zinc-200/80 bg-zinc-100/70 p-1 text-xs font-semibold text-zinc-600">
            <button
              type="button"
              onClick={() => setBreakdownTab("education")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                breakdownTab === "education"
                  ? "bg-white font-bold text-[#002b7f] shadow-2xs"
                  : "hover:text-zinc-950"
              }`}
            >
              <GraduationCap className="size-3.5" />
              <span>Educación</span>
            </button>
            <button
              type="button"
              onClick={() => setBreakdownTab("occupation")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                breakdownTab === "occupation"
                  ? "bg-white font-bold text-[#002b7f] shadow-2xs"
                  : "hover:text-zinc-950"
              }`}
            >
              <Briefcase className="size-3.5" />
              <span>Ocupación</span>
            </button>
            <button
              type="button"
              onClick={() => setBreakdownTab("goal")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                breakdownTab === "goal"
                  ? "bg-white font-bold text-[#002b7f] shadow-2xs"
                  : "hover:text-zinc-950"
              }`}
            >
              <Target className="size-3.5" />
              <span>Meta Principal</span>
            </button>
          </div>
        </div>

        {/* Rows List */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-zinc-100 animate-pulse" />
              ))}
            </div>
          ) : sortedRows.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-zinc-200 rounded-2xl">
              No hay datos disponibles para esta combinación de filtros.
            </div>
          ) : (
            sortedRows.map((row) => {
              const pct = row.metrics?.category_pct?.value;
              const count = row.metrics?.category_count?.value ?? row.sampleSize;
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
                        `${pct === null || pct === undefined ? "No disponible" : `${pct.toFixed(1)}%`} (${count === null ? "No disponible" : count.toLocaleString()})`
                      )}
                    </span>
                  </div>

                  {/* Sleek Gradient Bar */}
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        breakdownTab === "goal" ? "bg-[#ff6a00]" : "bg-[#002b7f]"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
