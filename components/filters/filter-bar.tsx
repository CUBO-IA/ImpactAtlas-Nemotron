"use client";

import React, { useEffect, useState } from "react";
import type { Filters } from "@/src/contracts/common";
import type { CatalogResponse } from "@/src/contracts/catalog";
import { Filter, RotateCcw } from "lucide-react";

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
  const [catalog, setCatalog] = useState<CatalogResponse["data"] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
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
    <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-orange-50 text-[#ff6a00]">
            <Filter className="size-4" />
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
                <span className="inline-block w-12 h-3.5 bg-zinc-200 rounded animate-pulse" />
              ) : (
                sampleSize === null ? "No disponible" : `${sampleSize.toLocaleString()} registros`
              )}
            </span>
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
            >
              <RotateCcw className="size-3" />
              Limpiar ({activeCount})
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Income Range */}
        <div className="space-y-1.5">
          <label htmlFor="filter-income-min" className="font-semibold text-zinc-700">Ingreso estimado (USD)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              id="filter-income-min"
              aria-label="Ingreso mínimo estimado en USD"
              placeholder="Mín"
              value={filters.income?.min ?? ""}
              onChange={(e) => handleIncomeChange(e.target.value, String(filters.income?.max ?? ""))}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs focus:border-[#002b7f] focus:bg-white focus:outline-none"
            />
            <span className="text-zinc-400">—</span>
            <input
              type="number"
              aria-label="Ingreso máximo estimado en USD"
              placeholder="Máx"
              value={filters.income?.max ?? ""}
              onChange={(e) => handleIncomeChange(String(filters.income?.min ?? ""), e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs focus:border-[#002b7f] focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Education Level */}
        <div className="space-y-1.5">
          <label className="font-semibold text-zinc-700">Nivel Educativo</label>
          <select
            value={filters.educationIds?.[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              const next = { ...filters };
              if (val) next.educationIds = [val];
              else delete next.educationIds;
              onChangeFilters(next);
            }}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs focus:border-[#002b7f] focus:bg-white focus:outline-none"
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
          <label className="font-semibold text-zinc-700">Ocupación / Rubro</label>
          <select
            value={filters.occupationIds?.[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              const next = { ...filters };
              if (val) next.occupationIds = [val];
              else delete next.occupationIds;
              onChangeFilters(next);
            }}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs focus:border-[#002b7f] focus:bg-white focus:outline-none"
          >
            <option value="">Todas las ocupaciones</option>
            {(catalog?.occupations ?? []).map((occ) => (
              <option key={occ.id} value={occ.id}>
                {occ.label}
              </option>
            ))}
          </select>
        </div>

        {/* Goal */}
        <div className="space-y-1.5">
          <label className="font-semibold text-zinc-700">Meta Financiera Principal</label>
          <select
            value={filters.goalIds?.[0] ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              const next = { ...filters };
              if (val) next.goalIds = [val];
              else delete next.goalIds;
              onChangeFilters(next);
            }}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3 py-2 text-xs focus:border-[#002b7f] focus:bg-white focus:outline-none"
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
