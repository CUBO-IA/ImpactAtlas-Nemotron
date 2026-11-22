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
      sample_count: metrics?.sample_count?.value ?? null,
      income_mean: metrics?.income_mean?.value ?? null,
      income_median: metrics?.income_median?.value ?? null,
      financial_exclusion_pct: metrics?.financial_exclusion_pct?.value ?? null,
      suppressed: metrics?.financial_exclusion_pct?.suppressed ?? false,
    };
  });

  rows.sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    if (valA === null) valA = sortAsc ? Infinity : -Infinity;
    if (valB === null) valB = sortAsc ? Infinity : -Infinity;

    if (valA < valB) return sortAsc ? -1 : 1;
    if (valA > valB) return sortAsc ? 1 : -1;
    return 0;
  });

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-zinc-100">
        <div>
          <h3 className="text-base font-bold text-zinc-950">
            Vista Tabular Accesible de Departamentos
          </h3>
          <p className="text-xs text-zinc-500">
            Alternativa tabular para consulta accesible de las métricas departamentales.
          </p>
        </div>
        {selectedDepartment && (
          <button
            type="button"
            onClick={() => onSelectDepartment(null)}
            className="text-xs text-[#ff6a00] hover:underline self-start sm:self-auto"
          >
            Deseleccionar filtro departamental
          </button>
        )}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 text-zinc-500 font-semibold bg-zinc-50/50">
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
                  onClick={() => onSelectDepartment(isSelected ? null : (row.id as DepartmentId))}
                  className={`transition-colors cursor-pointer hover:bg-zinc-50/80 ${
                    isSelected ? "bg-blue-50/70 font-semibold text-[#002b7f]" : "text-zinc-800"
                  }`}
                >
                  <td className="py-2.5 px-3 flex items-center gap-2">
                    {isSelected && <Check className="size-3.5 text-[#002b7f]" />}
                    <span>{row.label}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.suppressed ? (
                      <span className="text-zinc-400 italic">(&lt;5)</span>
                    ) : row.sample_count !== null ? (
                      row.sample_count.toLocaleString()
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.income_mean !== null ? `$${row.income_mean.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.income_median !== null ? `$${row.income_median.toFixed(2)}` : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono">
                    {row.financial_exclusion_pct !== null ? (
                      <span className="font-semibold text-[#ff6a00]">
                        {row.financial_exclusion_pct.toFixed(1)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDepartment(isSelected ? null : (row.id as DepartmentId));
                      }}
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
