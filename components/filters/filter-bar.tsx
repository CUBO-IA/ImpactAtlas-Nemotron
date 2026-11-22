"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Filters } from "@/src/contracts/common";
import type { CatalogResponse } from "@/src/contracts/catalog";
import { RotateCcw, SlidersHorizontal } from "lucide-react";

interface FilterBarProps {
  filters: Filters;
  onChangeFilters: (next: Filters) => void;
  sampleSize: number | null;
  loading: boolean;
  incomeDebounceMs?: number;
}

export function FilterBar({
  filters,
  onChangeFilters,
  sampleSize,
  loading,
  incomeDebounceMs = 0,
}: FilterBarProps) {
  const [catalog, setCatalog] = useState<CatalogResponse["data"] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  const [incomeMin, setIncomeMin] = useState(filters.income?.min?.toString() ?? "");
  const [incomeMax, setIncomeMax] = useState(filters.income?.max?.toString() ?? "");
  const incomeTimeoutRef = useRef<number | null>(null);
  const filtersRef = useRef(filters);
  const onChangeFiltersRef = useRef(onChangeFilters);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Catálogo: ${r.status}`);
        return r.json() as Promise<CatalogResponse>;
      })
      .then((value) => setCatalog(value.data))
      .catch(() => {
        if (!controller.signal.aborted) setCatalogError(true);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    filtersRef.current = filters;
    onChangeFiltersRef.current = onChangeFilters;
  }, [filters, onChangeFilters]);

  useEffect(
    () => () => {
      if (incomeTimeoutRef.current !== null) {
        window.clearTimeout(incomeTimeoutRef.current);
      }
    },
    [],
  );

  function scheduleIncomeChange(minStr: string, maxStr: string) {
    if (incomeTimeoutRef.current !== null) {
      window.clearTimeout(incomeTimeoutRef.current);
    }
    incomeTimeoutRef.current = window.setTimeout(() => {
      const min = minStr ? parseFloat(minStr) : undefined;
      const max = maxStr ? parseFloat(maxStr) : undefined;
      const currentFilters = filtersRef.current;

      if (min === undefined && max === undefined) {
        const next = { ...currentFilters };
        delete next.income;
        onChangeFiltersRef.current(next);
      } else {
        onChangeFiltersRef.current({
          ...currentFilters,
          income: {
            min: min !== undefined && !isNaN(min) && min >= 0 ? min : undefined,
            max: max !== undefined && !isNaN(max) && max >= 0 ? max : undefined,
          },
        });
      }
      incomeTimeoutRef.current = null;
    }, incomeDebounceMs);
  }

  const activeCount =
    (filters.departmentIds ? filters.departmentIds.length : 0) +
    (filters.income?.min !== undefined || filters.income?.max !== undefined ? 1 : 0) +
    (filters.educationIds ? filters.educationIds.length : 0) +
    (filters.occupationIds ? filters.occupationIds.length : 0) +
    (filters.goalIds ? filters.goalIds.length : 0);

  function handleReset() {
    if (incomeTimeoutRef.current !== null) {
      window.clearTimeout(incomeTimeoutRef.current);
      incomeTimeoutRef.current = null;
    }
    setIncomeMin("");
    setIncomeMax("");
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
            <h3 className="text-sm font-bold text-zinc-950">Filtros de la muestra</h3>
            <p className="text-[11px] text-zinc-500">
              Ajusta los parámetros para enfocar el análisis socioeconómico.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-zinc-500">Registros de muestra:</span>
            <span className="font-bold text-[#002b7f]">
              {loading ? (
                <span className="inline-block w-14 h-4 bg-zinc-200 rounded animate-pulse" />
              ) : (
                sampleSize === null ? "No disponible" : `${sampleSize.toLocaleString()} registros`
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
          <label htmlFor="filter-income-min" className="font-semibold text-zinc-700">Ingreso estimado (USD)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              id="filter-income-min"
              aria-label="Ingreso mínimo estimado en USD"
              placeholder="Mín"
              value={incomeMin}
              onChange={(e) => {
                setIncomeMin(e.target.value);
                if (incomeDebounceMs > 0) {
                  scheduleIncomeChange(e.target.value, incomeMax);
                } else {
                  handleIncomeChange(e.target.value, incomeMax);
                }
              }}
              className="w-full rounded-xl border border-zinc-200/80 bg-zinc-50/50 px-3 py-2 text-xs font-mono text-zinc-900 transition-all placeholder:text-zinc-400 focus:bg-white focus:border-[#002b7f] focus:outline-none focus:ring-2 focus:ring-[#002b7f]/15"
            />
            <span className="text-zinc-400 font-mono">—</span>
            <input
              type="number"
              aria-label="Ingreso máximo estimado en USD"
              placeholder="Máx"
              value={incomeMax}
              onChange={(e) => {
                setIncomeMax(e.target.value);
                if (incomeDebounceMs > 0) {
                  scheduleIncomeChange(incomeMin, e.target.value);
                } else {
                  handleIncomeChange(incomeMin, e.target.value);
                }
              }}
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
            {(catalog?.education ?? []).map((ed) => (
              <option key={ed.id} value={ed.id}>
                {ed.label}
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
            {(catalog?.occupations ?? []).map((occ) => (
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
            {(catalog?.goals ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {catalogError && (
        <p role="alert" className="mt-3 text-xs text-red-700">
          No se pudo cargar el catálogo de filtros. Recarga la página para volver a intentarlo.
        </p>
      )}
    </div>
  );
}
