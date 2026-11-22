"use client";

import type { DepartmentId, MetricId } from "@/src/contracts/common";
import type { CompareResponse } from "@/src/contracts/compare";
import { Star, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle } from "lucide-react";

type DepartmentData = CompareResponse["data"]["departments"][number];

interface ComparisonTableProps {
  departments: DepartmentData[];
  referenceId: DepartmentId;
  selectedMetrics: MetricId[];
  onSetReference: (id: DepartmentId) => void;
}

export function ComparisonTable({
  departments,
  referenceId,
  selectedMetrics,
  onSetReference,
}: ComparisonTableProps) {
  const referenceDept = departments.find((d) => d.id === referenceId);

  // Helper to format metric values
  const formatMetric = (metricId: MetricId, dept: DepartmentData) => {
    const metric = dept.metrics[metricId];
    if (!metric) return { text: "—", status: "none" };

    if (metric.suppressed) {
      return {
        text: "Suprimido (n < 5)",
        status: "suppressed",
        reason: metric.reason,
      };
    }

    if (metric.value === null) {
      return {
        text: metric.reason === "empty" ? "Sin datos (0)" : "N/D",
        status: "empty",
      };
    }

    if (metricId === "sample_count") {
      return { text: `${metric.value.toLocaleString("es-SV")} reg`, status: "valid" };
    }
    if (metricId === "financial_exclusion_pct") {
      return { text: `${metric.value.toFixed(1)}%`, status: "valid" };
    }
    return { text: `$${metric.value.toFixed(2)}`, status: "valid" };
  };

  // Helper to format delta differences
  const formatDifference = (metricId: MetricId, dept: DepartmentData) => {
    if (dept.id === referenceId) {
      return { text: "Base", type: "base" as const };
    }

    const diff = dept.differences.find((d) => d.metricId === metricId);
    if (!diff || diff.value === null) {
      return { text: "N/D", type: "neutral" as const };
    }

    const sign = diff.value > 0 ? "+" : "";
    let formattedValue = "";

    if (diff.unit === "percentage_points") {
      formattedValue = `${sign}${diff.value.toFixed(1)} pp`;
    } else if (diff.unit === "usd_estimated") {
      formattedValue = `${sign}$${diff.value.toFixed(2)}`;
    } else {
      formattedValue = `${sign}${diff.value.toLocaleString("es-SV")}`;
    }

    if (diff.value === 0) {
      return { text: "0.00", type: "neutral" as const };
    }

    // Determine good vs bad direction
    // For income and sample: positive is good (green), negative is bad (red)
    // For financial_exclusion_pct: positive is BAD (more exclusion), negative is GOOD (less exclusion)
    let isPositive = diff.value > 0;
    if (metricId === "financial_exclusion_pct") {
      isPositive = diff.value < 0;
    }

    return {
      text: formattedValue,
      type: isPositive ? ("positive" as const) : ("negative" as const),
      val: diff.value,
    };
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards comparing Departments against Reference */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {selectedMetrics.map((metricId) => {
          const title =
            metricId === "financial_exclusion_pct"
              ? "Exclusión Financiera"
              : metricId === "income_mean"
              ? "Ingreso Medio"
              : metricId === "income_median"
              ? "Ingreso Mediano"
              : "Muestra Total";

          const refFormatted = referenceDept ? formatMetric(metricId, referenceDept) : null;

          return (
            <div
              key={metricId}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  {title}
                </span>
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-[#002b7f]">
                  <Star className="size-3 fill-[#002b7f]" />
                  Base: {referenceDept?.label ?? "—"}
                </span>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-black text-zinc-900 tracking-tight">
                  {refFormatted?.text ?? "—"}
                </span>
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                Punto de referencia territorial para el cálculo de brechas relativas y puntos porcentuales.
              </p>
            </div>
          );
        })}
      </div>

      {/* Main Comparative Matrix Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xs">
        <div className="p-4 sm:px-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-zinc-900">
              Matriz Comparativa de Brechas y Diferencias
            </h3>
            <p className="text-xs text-zinc-500">
              Las diferencias ($\Delta$) se calculan restando el valor del departamento de referencia ({referenceDept?.label}).
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-600">
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <span className="size-2 rounded-full bg-emerald-500" />
              Favorable
            </span>
            <span className="inline-flex items-center gap-1 text-rose-700 font-medium ml-2">
              <span className="size-2 rounded-full bg-rose-500" />
              Desfavorable
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 pl-6 pr-3">Departamento</th>
                <th className="py-3.5 px-3 text-right">Muestra (n)</th>
                {selectedMetrics.includes("income_mean") && (
                  <th className="py-3.5 px-3 text-right">Ingreso Medio Estimado</th>
                )}
                {selectedMetrics.includes("income_median") && (
                  <th className="py-3.5 px-3 text-right">Ingreso Mediano</th>
                )}
                {selectedMetrics.includes("financial_exclusion_pct") && (
                  <th className="py-3.5 px-3 text-right">Exclusión Financiera</th>
                )}
                <th className="py-3.5 pl-3 pr-6 text-center">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {departments.map((dept) => {
                const isRef = dept.id === referenceId;

                return (
                  <tr
                    key={dept.id}
                    className={`transition-colors ${
                      isRef ? "bg-blue-50/40 font-medium" : "hover:bg-zinc-50/80"
                    }`}
                  >
                    {/* Department name */}
                    <td className="py-3.5 pl-6 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900">{dept.label}</span>
                        {isRef && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#002b7f] px-2 py-0.5 text-[10px] font-semibold text-white">
                            <Star className="size-2.5 fill-white" />
                            Base
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sample Size */}
                    <td className="py-3.5 px-3 text-right">
                      {dept.sampleSize === null ? (
                        <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                          <AlertTriangle className="size-3" />
                          &lt; 5
                        </span>
                      ) : (
                        <span>{dept.sampleSize.toLocaleString("es-SV")}</span>
                      )}
                    </td>

                    {/* Income Mean */}
                    {selectedMetrics.includes("income_mean") && (
                      <td className="py-3.5 px-3 text-right">
                        {renderMetricCell(
                          formatMetric("income_mean", dept),
                          formatDifference("income_mean", dept)
                        )}
                      </td>
                    )}

                    {/* Income Median */}
                    {selectedMetrics.includes("income_median") && (
                      <td className="py-3.5 px-3 text-right">
                        {renderMetricCell(
                          formatMetric("income_median", dept),
                          formatDifference("income_median", dept)
                        )}
                      </td>
                    )}

                    {/* Financial Exclusion */}
                    {selectedMetrics.includes("financial_exclusion_pct") && (
                      <td className="py-3.5 px-3 text-right">
                        {renderMetricCell(
                          formatMetric("financial_exclusion_pct", dept),
                          formatDifference("financial_exclusion_pct", dept)
                        )}
                      </td>
                    )}

                    {/* Reference toggle button */}
                    <td className="py-3.5 pl-3 pr-6 text-center">
                      {isRef ? (
                        <span className="text-[11px] font-semibold text-[#002b7f]">
                          Base activa
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSetReference(dept.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:border-[#002b7f] hover:text-[#002b7f] transition-all shadow-2xs"
                        >
                          <Star className="size-3" />
                          Hacer base
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function renderMetricCell(
  formatted: { text: string; status: string; reason?: string | null },
  diff: { text: string; type: "base" | "positive" | "negative" | "neutral" }
) {
  if (formatted.status === "suppressed") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
        <AlertTriangle className="size-3" />
        Suprimido (n &lt; 5)
      </span>
    );
  }

  if (formatted.status === "empty") {
    return <span className="text-zinc-400">Sin datos</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <span className="font-semibold text-zinc-900">{formatted.text}</span>
      {diff.type === "base" ? (
        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          Base
        </span>
      ) : diff.type === "positive" ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
          <ArrowUpRight className="size-3" />
          {diff.text}
        </span>
      ) : diff.type === "negative" ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-rose-50 border border-rose-200 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
          <ArrowDownRight className="size-3" />
          {diff.text}
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
          <Minus className="size-3" />
          {diff.text}
        </span>
      )}
    </div>
  );
}
