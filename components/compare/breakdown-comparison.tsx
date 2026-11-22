"use client";

import { useEffect, useState } from "react";
import type { DepartmentId } from "@/src/contracts/common";
import type { CompareResponse } from "@/src/contracts/compare";
import type { CatalogResponse } from "@/src/contracts/catalog";
import { GraduationCap, Briefcase, Target, Star, AlertTriangle } from "lucide-react";

type DepartmentData = CompareResponse["data"]["departments"][number];

interface BreakdownComparisonProps {
  departments: DepartmentData[];
  referenceId: DepartmentId;
  activeBreakdown: "education" | "occupation" | "goal";
  onChangeBreakdown: (b: "education" | "occupation" | "goal") => void;
}

export function BreakdownComparison({
  departments,
  referenceId,
  activeBreakdown,
  onChangeBreakdown,
}: BreakdownComparisonProps) {
  const [catalog, setCatalog] = useState<CatalogResponse["data"] | null>(null);
  const [catalogError, setCatalogError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Catálogo: ${response.status}`);
        return response.json() as Promise<CatalogResponse>;
      })
      .then((value) => setCatalog(value.data))
      .catch(() => {
        if (!controller.signal.aborted) setCatalogError(true);
      });
    return () => controller.abort();
  }, []);
  const referenceDept = departments.find((d) => d.id === referenceId);

  const catalogItems =
    activeBreakdown === "education" ? catalog?.education
      : activeBreakdown === "occupation" ? catalog?.occupations
        : catalog?.goals;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4 gap-3">
        <div>
          <h3 className="text-sm font-bold text-zinc-900">
            Comparación de Distribuciones Categóricas
          </h3>
          <p className="text-xs text-zinc-500">
            Categorías alineadas en el orden oficial del catálogo. Diferencias expresadas en puntos porcentuales (pp) respecto a {referenceDept?.label ?? "la referencia"}.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 rounded-xl bg-zinc-100 p-1">
          <button
            type="button"
            onClick={() => onChangeBreakdown("education")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeBreakdown === "education"
                ? "bg-white text-[#002b7f] shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <GraduationCap className="size-3.5" />
            Educación
          </button>
          <button
            type="button"
            onClick={() => onChangeBreakdown("occupation")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeBreakdown === "occupation"
                ? "bg-white text-[#002b7f] shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Briefcase className="size-3.5" />
            Ocupación
          </button>
          <button
            type="button"
            onClick={() => onChangeBreakdown("goal")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeBreakdown === "goal"
                ? "bg-white text-[#002b7f] shadow-xs"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            <Target className="size-3.5" />
            Meta Principal
          </button>
        </div>
      </div>

      {/* Categories Grid */}
      <div className="mt-5 space-y-6">
        {catalogError && <p role="alert" className="text-xs text-red-700">No se pudo cargar el catálogo de categorías.</p>}
        {(catalogItems ?? []).map((item) => {
          // Find reference category data
          const refRows = referenceDept?.breakdowns[activeBreakdown] ?? [];
          const refRow = refRows.find((r) => r.key === item.id);
          const refPct = refRow?.metrics.category_pct?.value ?? null;

          return (
            <div
              key={item.id}
              className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 transition-colors hover:bg-zinc-50"
            >
              <div className="flex items-center justify-between border-b border-zinc-200/60 pb-2 mb-3">
                <span className="text-xs font-bold text-zinc-900">{item.label}</span>
                {refPct !== null && (
                  <span className="text-[11px] font-medium text-zinc-500">
                    Base ({referenceDept?.label}):{" "}
                    <strong className="text-zinc-800">{refPct.toFixed(1)}%</strong>
                  </span>
                )}
              </div>

              {/* Department breakdown bars */}
              <div className="space-y-2.5">
                {departments.map((dept) => {
                  const isRef = dept.id === referenceId;
                  const rows = dept.breakdowns[activeBreakdown] ?? [];
                  const row = rows.find((r) => r.key === item.id);
                  const countMetric = row?.metrics.category_count;
                  const pctMetric = row?.metrics.category_pct;

                  const isSuppressed = countMetric?.suppressed || pctMetric?.suppressed;
                  const pct = pctMetric?.value;
                  const count = countMetric?.value;

                  // Delta in percentage points
                  let deltaPp: number | null = null;
                  if (typeof pctMetric?.value === "number" && typeof refPct === "number") {
                    deltaPp = Math.round((pctMetric.value - refPct) * 10) / 10;
                  }

                  return (
                    <div key={dept.id} className="grid grid-cols-1 sm:grid-cols-12 items-center gap-2 text-xs">
                      {/* Dept Label */}
                      <div className="sm:col-span-3 flex items-center gap-1.5">
                        <span className="font-semibold text-zinc-800 truncate">{dept.label}</span>
                        {isRef && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1 py-0.2 text-[9px] font-bold text-[#002b7f]">
                            <Star className="size-2.5 fill-[#002b7f]" />
                            Base
                          </span>
                        )}
                      </div>

                      {/* Bar Visualizer */}
                      <div className="sm:col-span-6 flex items-center gap-2">
                        <div className="h-2.5 w-full rounded-full bg-zinc-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isRef
                                ? "bg-[#002b7f]"
                                : "bg-blue-400"
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, pct ?? 0))}%` }}
                          />
                        </div>
                      </div>

                      {/* Values & Delta */}
                      <div className="sm:col-span-3 flex items-center justify-end gap-2 text-right">
                        {isSuppressed ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="size-2.5" />
                            &lt; 5
                          </span>
                        ) : (
                          <>
                            <span className="font-bold text-zinc-900">{pct === null || pct === undefined ? "No disponible" : `${pct.toFixed(1)}%`}</span>
                            <span className="text-[10px] text-zinc-400">({count === null || count === undefined ? "No disponible" : count.toLocaleString("es-SV")})</span>
                            {isRef ? (
                              <span className="rounded bg-zinc-100 px-1 py-0.2 text-[9px] font-bold text-zinc-500">
                                0.0 pp
                              </span>
                            ) : deltaPp !== null ? (
                              <span
                                className={`rounded px-1 py-0.2 text-[9px] font-bold ${
                                  deltaPp > 0
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : deltaPp < 0
                                    ? "bg-rose-50 text-rose-700 border border-rose-200"
                                    : "bg-zinc-100 text-zinc-600"
                                }`}
                              >
                                {deltaPp > 0 ? `+${deltaPp.toFixed(1)}` : deltaPp.toFixed(1)} pp
                              </span>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
