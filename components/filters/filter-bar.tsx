"use client";

import React from "react";
import type { Filters } from "@/src/contracts/common";
import {
  EDUCATION,
  OCCUPATIONS,
  GOALS,
} from "@/src/lib/catalog-data";
import { Filter, RotateCcw, SlidersHorizontal, Users, DollarSign, Sparkles } from "lucide-react";

interface FilterBarProps {
  filters: Filters;
  onChangeFilters: (next: Filters) => void;
  sampleSize: number | null;
  loading: boolean;
}

export function FilterBar({
  filters,
  onChangeFilters,
  sampleSize,
  loading,
}: FilterBarProps) {
  const activeCount =
    (filters.departmentIds ? filters.departmentIds.length : 0) +
    (filters.income?.min !== undefined || filters.income?.max !== undefined ? 1 : 0) +
    (filters.educationIds ? filters.educationIds.length : 0) +
    (filters.occupationIds ? filters.occupationIds.length : 0) +
    (filters.goalIds ? filters.goalIds.length : 0);

  function handleReset() {
    onChangeFilters({});
  }

  function handleIncomeChange(minStr: string, maxStr: string) {
    const min = minStr ? parseFloat(minStr) : undefined;
    const max = maxStr ? parseFloat(maxStr) : undefined;

    if (min === undefined && max === undefined) {
      const next = { ...filters };
      delete next.income;
      onChangeFilters(next);
    } else {
      onChangeFilters({
        ...filters,
        income: {
          min: min !== undefined && !isNaN(min) && min >= 0 ? min : undefined,
          max: max !== undefined && !isNaN(max) && max >= 0 ? max : undefined,
        },
      });
    }
  }

  return (
    <div className="glass-surface hud-bracket rounded-3xl p-6 shadow-sm transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-200/60">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-orange-50 text-[#ff6a00] shadow-2xs border border-orange-100">
            <SlidersHorizontal className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-zinc-950">Filtros de Cohorte Poblacional</h3>
              {activeCount > 0 && (
                <span className="inline-flex items-center rounded-full bg-[#002b7f] px-2 py-0.5 text-[10px] font-mono font-bold text-white shadow-2xs">
                  {activeCount} activo{activeCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Segmenta los 50,000 registros para calibrar las estimaciones socioeconómicas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-3.5 py-1.5 text-xs font-mono shadow-2xs">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-zinc-500">MUESTRA:</span>
            <span className="font-bold text-[#002b7f]">
              {loading ? (
                <span className="inline-block w-14 h-4 bg-zinc-200 rounded animate-pulse" />
              ) : (
                `${(sampleSize ?? 0).toLocaleString()} perfiles`
              )}
            </span>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="group inline-flex items-center gap-1.5 rounded-xl border border-zinc-200/80 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition-all hover:border-red-300 hover:text-red-600 hover:bg-red-50/50 shadow-2xs active:scale-95"
            >
              <RotateCcw className="size-3 transition-transform group-hover:-rotate-90 duration-300" />
              Restablecer
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Income Range */}
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-600 flex items-center gap-1">
            <DollarSign className="size-3 text-[#002b7f]" />
            Rango de Ingreso ($ USD)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="50"
              placeholder="Mín"
              value={filters.income?.min ?? ""}
              onChange={(e) =>
                handleIncomeChange(e.target.value, filters.income?.max?.toString() ?? "")
              }
              className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs font-mono text-zinc-900 transition-all placeholder:text-zinc-400 focus:bg-white focus:border-[#002b7f] focus:outline-none focus:ring-2 focus:ring-[#002b7f]/15"
            />
            <span className="text-zinc-400 font-mono">—</span>
            <input
              type="number"
              min="0"
              step="50"
              placeholder="Máx"
              value={filters.income?.max ?? ""}
              onChange={(e) =>
                handleIncomeChange(filters.income?.min?.toString() ?? "", e.target.value)
              }
              className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs font-mono text-zinc-900 transition-all placeholder:text-zinc-400 focus:bg-white focus:border-[#002b7f] focus:outline-none focus:ring-2 focus:ring-[#002b7f]/15"
            />
          </div>
        </div>

        {/* Education Level */}
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-600">
            Nivel Educativo
          </label>
          <select
            value={filters.educationIds?.[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onChangeFilters({
                ...filters,
                educationIds: val ? [val] : undefined,
              });
            }}
            className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-900 transition-all focus:bg-white focus:border-[#002b7f] focus:outline-none focus:ring-2 focus:ring-[#002b7f]/15"
          >
            <option value="">Todos los niveles</option>
            {EDUCATION.map((edu) => (
              <option key={edu.id} value={edu.id}>
                {edu.label}
              </option>
            ))}
          </select>
        </div>

        {/* Occupation */}
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-600">
            Sector Ocupacional
          </label>
          <select
            value={filters.occupationIds?.[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onChangeFilters({
                ...filters,
                occupationIds: val ? [val] : undefined,
              });
            }}
            className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-900 transition-all focus:bg-white focus:border-[#002b7f] focus:outline-none focus:ring-2 focus:ring-[#002b7f]/15"
          >
            <option value="">Todas las ocupaciones</option>
            {OCCUPATIONS.map((occ) => (
              <option key={occ.id} value={occ.id}>
                {occ.label}
              </option>
            ))}
          </select>
        </div>

        {/* Goal / Priority */}
        <div className="space-y-1.5">
          <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-600">
            Meta Prioritaria
          </label>
          <select
            value={filters.goalIds?.[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              onChangeFilters({
                ...filters,
                goalIds: val ? [val] : undefined,
              });
            }}
            className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs text-zinc-900 transition-all focus:bg-white focus:border-[#002b7f] focus:outline-none focus:ring-2 focus:ring-[#002b7f]/15"
          >
            <option value="">Todas las metas</option>
            {GOALS.map((goal) => (
              <option key={goal.id} value={goal.id}>
                {goal.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
