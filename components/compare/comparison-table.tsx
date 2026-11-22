"use client";

import type { DepartmentId, MetricId } from "@/src/contracts/common";
import type { CompareResponse } from "@/src/contracts/compare";
import { Star, ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Layers, TrendingUp, DollarSign, Users } from "lucide-react";

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
      return { text: `${metric.value.toLocaleString("es-SV")} perfiles`, status: "valid" };
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
      {/* Reference Summary KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {selectedMetrics.map((metricId) => {
          const title =
            metricId === "financial_exclusion_pct"
              ? "Exclusión Financiera"
              : metricId === "income_mean"
              ? "Ingreso Promedio"
              : metricId === "income_median"
              ? "Ingreso Mediano"
              : "Muestra Departamental";

          const refMetric = referenceDept?.metrics[metricId];
          const refFormatted = referenceDept ? formatMetric(metricId, referenceDept) : null;

          const isExclusion = metricId === "financial_exclusion_pct";
          const isIncome = metricId === "income_mean";

          return (
            <div
              key={metricId}
              className={`relative overflow-hidden rounded-2xl border p-4.5 shadow-2xs transition-all ${
                isExclusion
                  ? "border-orange-200/80 bg-gradient-to-b from-orange-50/40 via-white to-white"
                  : isIncome
                  ? "border-blue-200/80 bg-gradient-to-b from-blue-50/40 via-white to-white"
                  : "border-zinc-200/80 bg-gradient-to-b from-zinc-50/50 via-white to-white"
              }`}
            >
              <div
                className={`h-1 w-full absolute top-0 left-0 bg-gradient-to-r ${
                  isExclusion
                    ? "from-[#ff6a00] to-amber-400"
                    : isIncome
                    ? "from-[#002b7f] to-blue-400"
                    : "from-zinc-500 to-zinc-400"
                }`}
              />
              <div className="flex items-center justify-between text-xs text-zinc-500 mb-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-700">
                  {title}
                </span>
                {isExclusion ? (
                  <TrendingUp className="size-4 text-[#ff6a00]" />
                ) : isIncome ? (
                  <DollarSign className="size-4 text-[#002b7f]" />
                ) : (
                  <Users className="size-4 text-zinc-500" />
                )}
              </div>

              <div className="font-mono text-2xl font-extrabold text-zinc-950 tracking-tight">
                {refFormatted?.text ?? "—"}
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-500">
                <Star className="size-3 fill-orange-400 text-orange-400" />
                <span className="font-medium">
                  Base: <strong className="text-zinc-800">{referenceDept?.label ?? "N/D"}</strong>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Futuristic Comparison Matrix Table */}
      <div className="glass-surface hud-bracket overflow-hidden rounded-3xl border border-zinc-200/80 shadow-sm">
        <div className="border-b border-zinc-200/60 p-5 bg-gradient-to-r from-zinc-50/80 to-white flex items-center justify-between">
          <div>
            <h3 className="text-sm font-extrabold text-zinc-950">Matriz Comparativa Departamental</h3>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Diferencias calculadas respecto al territorio base (
              <span className="font-bold text-orange-600">{referenceDept?.label}</span>).
            </p>
          </div>
          <span className="font-mono text-[11px] text-zinc-400">
            {departments.length} TERRITORIOS
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-200/80 bg-zinc-50/90 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-600">
              <tr>
                <th className="py-3 px-4 sm:px-6">Departamento</th>
                {selectedMetrics.map((metricId) => (
                  <th key={metricId} className="py-3 px-4">
                    {metricId === "financial_exclusion_pct"
                      ? "Exclusión (%)"
                      : metricId === "income_mean"
                      ? "Ingreso Medio ($)"
                      : metricId === "income_median"
                      ? "Ingreso Mediano ($)"
                      : "Muestra (n)"}
                  </th>
                ))}
                <th className="py-3 px-4 text-right">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/60 font-sans">
              {departments.map((dept) => {
                const isRef = dept.id === referenceId;

                return (
                  <tr
                    key={dept.id}
                    className={`transition-colors duration-150 ${
                      isRef
                        ? "bg-orange-50/40 hover:bg-orange-50/60"
                        : "hover:bg-zinc-50/80"
                    }`}
                  >
                    {/* Department Name */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-2">
                        {isRef && (
                          <Star className="size-3.5 fill-orange-500 text-orange-500 shrink-0" />
                        )}
                        <span className={`font-bold ${isRef ? "text-orange-950" : "text-zinc-900"}`}>
                          {dept.label}
                        </span>
                        {isRef && (
                          <span className="rounded-full bg-orange-100 border border-orange-200 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-800">
                            BASE
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Metrics and Diff Columns */}
                    {selectedMetrics.map((metricId) => {
                      const formatted = formatMetric(metricId, dept);
                      const diff = formatDifference(metricId, dept);

                      return (
                        <td key={metricId} className="py-3.5 px-4">
                          <div className="font-mono font-bold text-zinc-900 text-xs">
                            {formatted.text}
                          </div>

                          {/* Difference Badge */}
                          {!isRef && diff.type !== "base" && (
                            <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
                              {diff.type === "positive" ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 font-bold text-emerald-700">
                                  <ArrowUpRight className="size-3" />
                                  {diff.text}
                                </span>
                              ) : diff.type === "negative" ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-rose-50 border border-rose-200/80 px-1.5 py-0.5 font-bold text-rose-700">
                                  <ArrowDownRight className="size-3" />
                                  {diff.text}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-zinc-500">
                                  <Minus className="size-2.5" />
                                  {diff.text}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* Action to set as Reference */}
                    <td className="py-3.5 px-4 text-right">
                      {!isRef ? (
                        <button
                          type="button"
                          onClick={() => onSetReference(dept.id)}
                          className="rounded-lg border border-zinc-200/80 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 hover:border-[#002b7f] hover:text-[#002b7f] hover:bg-blue-50/50 transition-all shadow-2xs active:scale-95"
                        >
                          Fijar Base
                        </button>
                      ) : (
                        <span className="font-mono text-[11px] font-bold text-orange-600">
                          ACTUAL
                        </span>
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
