"use client";

import React, { useState } from "react";
import {
  SV_DEPARTMENT_PATHS,
  SV_MAP_WIDTH,
  SV_MAP_HEIGHT,
  type DeptMapPath,
} from "@/src/lib/sv-map-paths";
import type { DepartmentId, MetricValue } from "@/src/contracts/common";

export type ActiveMapMetric = "financial_exclusion_pct" | "income_mean" | "sample_count";

interface SvChoroplethMapProps {
  data: Map<string, Record<string, MetricValue>>;
  selectedDepartment: DepartmentId | null;
  onSelectDepartment: (id: DepartmentId | null) => void;
  activeMetric: ActiveMapMetric;
  onChangeMetric: (metric: ActiveMapMetric) => void;
}

export function SvChoroplethMap({
  data,
  selectedDepartment,
  onSelectDepartment,
  activeMetric,
  onChangeMetric,
}: SvChoroplethMapProps) {
  const [hoveredDept, setHoveredDept] = useState<DeptMapPath | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Extract values to compute color scales
  const values: number[] = [];
  SV_DEPARTMENT_PATHS.forEach((dept) => {
    const metrics = data.get(dept.id);
    const val = metrics?.[activeMetric]?.value;
    if (typeof val === "number" && !metrics?.[activeMetric]?.suppressed) {
      values.push(val);
    }
  });

  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 100;

  function getColor(deptId: string): string {
    const metrics = data.get(deptId);
    const metricObj = metrics?.[activeMetric];

    if (!metricObj || metricObj.value === null) {
      return "#f3f4f6"; // Gray-100 for empty / no data
    }
    if (metricObj.suppressed) {
      return "#e5e7eb"; // Gray-200 for suppressed
    }

    const val = metricObj.value;
    const ratio = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;

    if (activeMetric === "financial_exclusion_pct") {
      // Warm orange to deep amber/vermilion
      if (ratio < 0.25) return "#fed7aa"; // orange-200
      if (ratio < 0.5) return "#fb923c"; // orange-400
      if (ratio < 0.75) return "#ea580c"; // orange-600
      return "#9a3412"; // orange-800
    } else if (activeMetric === "income_mean") {
      // Light blue to deep navy
      if (ratio < 0.25) return "#bfdbfe"; // blue-200
      if (ratio < 0.5) return "#60a5fa"; // blue-400
      if (ratio < 0.75) return "#2563eb"; // blue-600
      return "#1e3a8a"; // blue-900
    } else {
      // Indigo to purple
      if (ratio < 0.25) return "#e0e7ff"; // indigo-100
      if (ratio < 0.5) return "#818cf8"; // indigo-400
      if (ratio < 0.75) return "#4f46e5"; // indigo-600
      return "#312e81"; // indigo-900
    }
  }

  function formatValue(val: number | null | undefined): string {
    if (val === null || val === undefined) return "Sin datos";
    if (activeMetric === "financial_exclusion_pct") return `${val.toFixed(1)}%`;
    if (activeMetric === "income_mean") return `$${val.toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    return `${val.toLocaleString()} perfiles`;
  }

  return (
    <div className="relative rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs flex flex-col">
      {/* Map Header with Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-100">
        <div>
          <h2 className="text-base font-bold text-zinc-950">Mapa de El Salvador (14 Departamentos)</h2>
          <p className="text-xs text-zinc-500">
            Haz clic en un departamento para filtrar el análisis o inspeccionar sus métricas.
          </p>
        </div>

        <div className="inline-flex rounded-xl bg-zinc-100 p-1 text-xs font-medium text-zinc-600">
          <button
            type="button"
            onClick={() => onChangeMetric("financial_exclusion_pct")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              activeMetric === "financial_exclusion_pct"
                ? "bg-white font-semibold text-[#ff6a00] shadow-xs"
                : "hover:text-zinc-900"
            }`}
          >
            Exclusión Financiera (%)
          </button>
          <button
            type="button"
            onClick={() => onChangeMetric("income_mean")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              activeMetric === "income_mean"
                ? "bg-white font-semibold text-[#002b7f] shadow-xs"
                : "hover:text-zinc-900"
            }`}
          >
            Ingreso Promedio ($)
          </button>
          <button
            type="button"
            onClick={() => onChangeMetric("sample_count")}
            className={`rounded-lg px-3 py-1.5 transition-all ${
              activeMetric === "sample_count"
                ? "bg-white font-semibold text-zinc-900 shadow-xs"
                : "hover:text-zinc-900"
            }`}
          >
            Muestra (n)
          </button>
        </div>
      </div>

      {/* Map SVG Canvas */}
      <div
        className="relative my-4 flex-1 flex items-center justify-center overflow-hidden min-h-[360px]"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => {
          setHoveredDept(null);
          setTooltipPos(null);
        }}
      >
        <svg
          viewBox={`0 0 ${SV_MAP_WIDTH} ${SV_MAP_HEIGHT}`}
          className="h-full w-full max-h-[460px] select-none transition-all drop-shadow-xs"
          role="img"
          aria-label="Mapa coroplético interactivo de El Salvador"
        >
          {SV_DEPARTMENT_PATHS.map((dept) => {
            const isSelected = selectedDepartment === dept.id;
            const isHovered = hoveredDept?.id === dept.id;
            const fillColor = getColor(dept.id);

            return (
              <g key={dept.id} className="cursor-pointer">
                <path
                  d={dept.d}
                  fill={fillColor}
                  stroke={isSelected ? "#002b7f" : isHovered ? "#ff6a00" : "#ffffff"}
                  strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1.2}
                  strokeLinejoin="round"
                  className="transition-all duration-150 focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  aria-label={`${dept.name}: ${formatValue(data.get(dept.id)?.[activeMetric]?.value)}`}
                  onMouseEnter={() => setHoveredDept(dept)}
                  onClick={() => {
                    onSelectDepartment(selectedDepartment === dept.id ? null : (dept.id as DepartmentId));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectDepartment(selectedDepartment === dept.id ? null : (dept.id as DepartmentId));
                    }
                  }}
                />
                {/* Center dot / Label */}
                <circle
                  cx={dept.cx}
                  cy={dept.cy}
                  r={isSelected ? 3.5 : 2}
                  fill={isSelected ? "#002b7f" : "#ffffff"}
                  stroke="#333333"
                  strokeWidth={0.8}
                  className="pointer-events-none opacity-80"
                />
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredDept && tooltipPos && (
          <div
            className="pointer-events-none absolute z-30 rounded-xl bg-zinc-950/90 px-3.5 py-2 text-xs text-white shadow-xl backdrop-blur-xs transition-transform transform -translate-x-1/2 -translate-y-full mb-2"
            style={{ left: tooltipPos.x, top: tooltipPos.y - 12 }}
          >
            <div className="font-bold text-sm text-zinc-100">{hoveredDept.name}</div>
            <div className="mt-1 flex items-center gap-1.5 text-zinc-300">
              <span className="font-semibold text-orange-400">
                {activeMetric === "financial_exclusion_pct"
                  ? "Exclusión Financiera:"
                  : activeMetric === "income_mean"
                  ? "Ingreso Promedio:"
                  : "Muestra:"}
              </span>
              <span>{formatValue(data.get(hoveredDept.id)?.[activeMetric]?.value)}</span>
            </div>
            <div className="text-[10px] text-zinc-400 mt-1">
              {selectedDepartment === hoveredDept.id ? "Clic para deseleccionar" : "Clic para ver detalle"}
            </div>
          </div>
        )}
      </div>

      {/* Map Legend & Selected Department Footer */}
      <div className="mt-auto pt-4 border-t border-zinc-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-medium">Escala:</span>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-400">{minVal.toFixed(0)}</span>
            <div className="flex h-3 w-28 overflow-hidden rounded-md border border-zinc-200">
              {activeMetric === "financial_exclusion_pct" ? (
                <>
                  <div className="flex-1 bg-[#fed7aa]" />
                  <div className="flex-1 bg-[#fb923c]" />
                  <div className="flex-1 bg-[#ea580c]" />
                  <div className="flex-1 bg-[#9a3412]" />
                </>
              ) : activeMetric === "income_mean" ? (
                <>
                  <div className="flex-1 bg-[#bfdbfe]" />
                  <div className="flex-1 bg-[#60a5fa]" />
                  <div className="flex-1 bg-[#2563eb]" />
                  <div className="flex-1 bg-[#1e3a8a]" />
                </>
              ) : (
                <>
                  <div className="flex-1 bg-[#e0e7ff]" />
                  <div className="flex-1 bg-[#818cf8]" />
                  <div className="flex-1 bg-[#4f46e5]" />
                  <div className="flex-1 bg-[#312e81]" />
                </>
              )}
            </div>
            <span className="text-[10px] text-zinc-400">{maxVal.toFixed(0)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDepartment ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-1 text-xs font-semibold text-[#002b7f]">
              <span>Departamento: {SV_DEPARTMENT_PATHS.find((d) => d.id === selectedDepartment)?.name}</span>
              <button
                type="button"
                onClick={() => onSelectDepartment(null)}
                className="ml-1 text-[#ff6a00] hover:underline"
              >
                (Ver Todos)
              </button>
            </div>
          ) : (
            <span className="text-zinc-500 text-xs">
              Mostrando los 14 departamentos (Nivel Nacional)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
