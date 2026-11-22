"use client";

import React, { useState } from "react";
import type { DepartmentId, MetricValue } from "@/src/contracts/common";
import { DEPARTMENTS } from "@/src/lib/catalog-data";
import { ArrowUpDown, Check } from "lucide-react";

interface DepartmentTableProps {
  data: Map<string, Record<string, MetricValue>>;
  selectedDepartment: DepartmentId | null;
  onSelectDepartment: (id: DepartmentId | null) => void;
}

type SortField = "label" | "sample_count" | "income_mean" | "income_median" | "financial_exclusion_pct";

export function DepartmentTable({
  data,
  selectedDepartment,
  onSelectDepartment,
}: DepartmentTableProps) {
  const [sortField, setSortField] = useState<SortField>("financial_exclusion_pct");
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  const rows = DEPARTMENTS.map((dept) => {
    const metrics = data.get(dept.id);
    return {
      id: dept.id,
      label: dept.label,
      sample_count: metrics?.sample_count,
      income_mean: metrics?.income_mean,
      income_median: metrics?.income_median,
      financial_exclusion_pct: metrics?.financial_exclusion_pct,
    };
  });

  rows.sort((a, b) => {
    let valA = sortField === "label"
      ? a.label
      : a[sortField]?.suppressed ? null : a[sortField]?.value ?? null;
    let valB = sortField === "label"
      ? b.label
      : b[sortField]?.suppressed ? null : b[sortField]?.value ?? null;
    if (valA === null) valA = sortAsc ? Infinity : -Infinity;
    if (valB === null) valB = sortAsc ? Infinity : -Infinity;

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="glass-surface hud-bracket rounded-3xl p-6 shadow-sm transition-all duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-200/60">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-[#002b7f]" />
            <h3 className="text-base font-extrabold text-zinc-950">
              Vista Tabular de Departamentos
            </h3>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Alternativa accesible para consulta tabular de las métricas departamentales.
          </p>
        </div>
        {selectedDepartment && (
          <button
            type="button"
            onClick={() => onSelectDepartment(null)}
            className="text-xs font-semibold text-[#ff6a00] hover:underline self-start sm:self-auto"
          >
            Restablecer selección nacional
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200/80 text-zinc-600 font-mono text-[11px] font-bold uppercase tracking-wider bg-zinc-50/70">
              <th className="py-2.5 px-3">
                <button
                  type="button"
                  onClick={() => handleSort("label")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900"
                >
                  Departamento
                  <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("sample_count")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 ml-auto"
                >
                  Muestra (n)
                  <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("income_mean")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 ml-auto"
                >
                  Ingreso Medio ($)
                  <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("income_median")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 ml-auto"
                >
                  Ingreso Mediano ($)
                  <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-right">
                <button
                  type="button"
                  onClick={() => handleSort("financial_exclusion_pct")}
                  className="inline-flex items-center gap-1 hover:text-zinc-900 ml-auto"
                >
                  Exclusión Financiera (%)
                  <ArrowUpDown className="size-3" />
                </button>
              </th>
              <th className="py-2.5 px-3 text-center">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => {
              const isSelected = selectedDepartment === row.id;

              return (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-zinc-50/80 ${
                    isSelected ? "bg-blue-50/70 font-semibold text-[#002b7f]" : "text-zinc-800"
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => onSelectDepartment(isSelected ? null : (row.id as DepartmentId))}
                      className="inline-flex items-center gap-2 text-left hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002b7f]"
                    >
                    {isSelected && <Check className="size-3.5 text-[#002b7f]" />}
                    <span>{row.label}</span>
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.sample_count?.suppressed ? "Suprimido" : row.sample_count?.value?.toLocaleString() ?? "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.income_mean?.suppressed ? "Suprimido" : row.income_mean?.value !== null && row.income_mean?.value !== undefined ? `$${row.income_mean.value.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.income_median?.suppressed ? "Suprimido" : row.income_median?.value !== null && row.income_median?.value !== undefined ? `$${row.income_median.value.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.financial_exclusion_pct?.suppressed ? "Suprimido" : row.financial_exclusion_pct?.value !== null && row.financial_exclusion_pct?.value !== undefined ? (
                      <span className="font-semibold text-[#ff6a00]">
                        {row.financial_exclusion_pct.value.toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={() => onSelectDepartment(isSelected ? null : (row.id as DepartmentId))}
                      className={`rounded-lg px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        isSelected
                          ? "bg-[#002b7f] text-white"
                          : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100"
                      }`}
                    >
                      {isSelected ? "Activo" : "Seleccionar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
