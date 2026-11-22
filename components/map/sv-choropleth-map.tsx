"use client";

import React, { useState } from "react";
import {
  SV_DEPARTMENT_PATHS,
  SV_MAP_WIDTH,
  SV_MAP_HEIGHT,
  type DeptMapPath,
} from "@/src/lib/sv-map-paths";
import type { DepartmentId, MetricValue } from "@/src/contracts/common";
import { Crosshair } from "lucide-react";

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
      return "#f1f5f9"; // Slate-100 for empty / no data
    }
    if (metricObj.suppressed) {
      return "#e2e8f0"; // Slate-200 for suppressed
    }

    const val = metricObj.value;
    const ratio = maxVal > minVal ? (val - minVal) / (maxVal - minVal) : 0.5;

    if (activeMetric === "financial_exclusion_pct") {
      // Warm orange to deep amber/vermilion
      if (ratio < 0.25) return "#ffedd5"; // orange-100
      if (ratio < 0.5) return "#fdba74"; // orange-300
      if (ratio < 0.75) return "#ea580c"; // orange-600
      return "#9a3412"; // orange-800
    } else if (activeMetric === "income_mean") {
      // Light cyan-blue to deep imperial navy
      if (ratio < 0.25) return "#dbeafe"; // blue-100
      if (ratio < 0.5) return "#60a5fa"; // blue-400
      if (ratio < 0.75) return "#2563eb"; // blue-600
      return "#1e3a8a"; // blue-900
    } else {
      // Indigo to violet
      if (ratio < 0.25) return "#ede9fe"; // violet-100
      if (ratio < 0.5) return "#a78bfa"; // violet-400
      if (ratio < 0.75) return "#7c3aed"; // violet-600
      return "#4c1d95"; // violet-900
    }
  }

  function formatValue(val: number | null | undefined): string {
    if (val === null || val === undefined) return "Sin datos";
    if (activeMetric === "financial_exclusion_pct") return `${val.toFixed(1)}%`;
    if (activeMetric === "income_mean") return `$${val.toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    return `${val.toLocaleString()} perfiles`;
  }

  const selectedDeptObj = SV_DEPARTMENT_PATHS.find((d) => d.id === selectedDepartment);

  return (
    <div className="glass-surface hud-bracket relative rounded-3xl p-6 sm:p-7 flex flex-col transition-all duration-300 shadow-sm">
      {/* Map Header with Telemetry & Metric Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              SVG local · 14 departamentos
            </span>
          </div>
          <h2 className="text-base font-extrabold text-zinc-950 flex items-center gap-2">
            Cartografía Coroplética Interactiva
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Selecciona un territorio para activar el visor estadístico o haz clic para alternar.
          </p>
        </div>

        {/* Metric Selector Buttons */}
        <div className="inline-flex rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-1 text-xs font-semibold text-zinc-600 shadow-2xs">
          <button
            type="button"
            onClick={() => onChangeMetric("financial_exclusion_pct")}
            className={`rounded-xl px-3 py-1.5 transition-all duration-200 ${
              activeMetric === "financial_exclusion_pct"
                ? "bg-white font-bold text-[#ff6a00] shadow-xs ring-1 ring-zinc-950/5"
                : "hover:text-zinc-950 hover:bg-white/50"
            }`}
          >
            Exclusión (%)
          </button>
          <button
            type="button"
            onClick={() => onChangeMetric("income_mean")}
            className={`rounded-xl px-3 py-1.5 transition-all duration-200 ${
              activeMetric === "income_mean"
                ? "bg-white font-bold text-[#002b7f] shadow-xs ring-1 ring-zinc-950/5"
                : "hover:text-zinc-950 hover:bg-white/50"
            }`}
          >
            Ingreso Promedio ($)
          </button>
          <button
            type="button"
            onClick={() => onChangeMetric("sample_count")}
            className={`rounded-xl px-3 py-1.5 transition-all duration-200 ${
              activeMetric === "sample_count"
                ? "bg-white font-bold text-violet-700 shadow-xs ring-1 ring-zinc-950/5"
                : "hover:text-zinc-950 hover:bg-white/50"
            }`}
          >
            Muestra (n)
          </button>
        </div>
      </div>

      {/* Map SVG Canvas with Ambient Backdrop */}
      <div
        className="relative my-4 flex-1 flex items-center justify-center overflow-hidden min-h-[380px] rounded-2xl bg-gradient-to-b from-blue-50/20 via-zinc-50/30 to-zinc-50/10 border border-zinc-200/50"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }}
        onMouseLeave={() => {
          setHoveredDept(null);
          setTooltipPos(null);
        }}
      >
        {/* Subtle Map Grid lines */}
        <div className="absolute inset-0 bg-tech-dots opacity-40 pointer-events-none" />

        <svg
          viewBox={`0 0 ${SV_MAP_WIDTH} ${SV_MAP_HEIGHT}`}
          className="relative z-10 h-full w-full max-h-[460px] select-none transition-all"
          role="img"
          aria-label="Mapa coroplético interactivo de El Salvador"
        >
          {SV_DEPARTMENT_PATHS.map((dept) => {
            const isSelected = selectedDepartment === dept.id;
            const isHovered = hoveredDept?.id === dept.id;
            const fillColor = getColor(dept.id);

            return (
              <g key={dept.id} className="cursor-pointer group">
                <path
                  d={dept.d}
                  fill={fillColor}
                  stroke={isSelected ? "#002b7f" : isHovered ? "#ff6a00" : "#ffffff"}
                  strokeWidth={isSelected ? 3.5 : isHovered ? 2.5 : 1.2}
                  strokeLinejoin="round"
                  style={{
                    filter: isSelected
                      ? "drop-shadow(0 6px 16px rgba(0, 43, 127, 0.4))"
                      : isHovered
                      ? "drop-shadow(0 4px 12px rgba(255, 106, 0, 0.35))"
                      : "drop-shadow(0 1px 2px rgba(0, 0, 0, 0.05))",
                    transition: "fill 0.3s ease, stroke 0.2s ease, filter 0.2s ease",
                  }}
                  className="focus:outline-none"
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

                {/* Center dot / centroid radar ping */}
                {isSelected ? (
                  <g className="pointer-events-none">
                    <circle
                      cx={dept.cx}
                      cy={dept.cy}
                      r={7}
                      fill="none"
                      stroke="#002b7f"
                      strokeWidth={1.5}
                      className="animate-ping opacity-75"
                    />
                    <circle
                      cx={dept.cx}
                      cy={dept.cy}
                      r={3.5}
                      fill="#002b7f"
                      stroke="#ffffff"
                      strokeWidth={1.2}
                    />
                  </g>
                ) : (
                  <circle
                    cx={dept.cx}
                    cy={dept.cy}
                    r={isHovered ? 2.8 : 2}
                    fill={isHovered ? "#ff6a00" : "#ffffff"}
                    stroke="#475569"
                    strokeWidth={0.8}
                    className="pointer-events-none opacity-80 transition-all duration-200"
                  />
                )}
              </g>
            );
          })}
        </svg>

        {/* Futuristic Glassmorphic Hover Tooltip */}
        {hoveredDept && tooltipPos && (
          <div
            className="pointer-events-none absolute z-30 rounded-2xl bg-zinc-950/90 border border-white/20 p-3.5 text-xs text-white shadow-2xl backdrop-blur-md transition-transform transform -translate-x-1/2 -translate-y-full mb-3 min-w-[190px]"
            style={{ left: tooltipPos.x, top: tooltipPos.y - 14 }}
          >
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1.5 mb-2">
              <span className="font-extrabold text-sm text-zinc-100">{hoveredDept.name}</span>
              <span className="font-mono text-[10px] text-zinc-400 uppercase">DEPTO</span>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="text-zinc-400">
                {activeMetric === "financial_exclusion_pct"
                  ? "Exclusión:"
                  : activeMetric === "income_mean"
                  ? "Ingreso Promedio:"
                  : "Muestra:"}
              </span>
              <span className="font-mono font-bold text-orange-400">
                {formatValue(data.get(hoveredDept.id)?.[activeMetric]?.value)}
              </span>
            </div>

            <div className="mt-2.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400">
              <span>{selectedDepartment === hoveredDept.id ? "Clic para deseleccionar" : "Clic para ver detalle"}</span>
              <Crosshair className="size-3 text-zinc-500" />
            </div>
          </div>
        )}
      </div>

      {/* Map Legend & Active Department Footer */}
      <div className="mt-auto pt-4 border-t border-zinc-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-zinc-500 font-semibold text-[11px] uppercase tracking-wider">Escala:</span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-bold text-zinc-600">{minVal.toFixed(0)}</span>
            <div className="flex h-3 w-32 overflow-hidden rounded-md border border-zinc-300/80 shadow-2xs">
              {activeMetric === "financial_exclusion_pct" ? (
                <>
                  <div className="flex-1 bg-[#ffedd5]" />
                  <div className="flex-1 bg-[#fdba74]" />
                  <div className="flex-1 bg-[#ea580c]" />
                  <div className="flex-1 bg-[#9a3412]" />
                </>
              ) : activeMetric === "income_mean" ? (
                <>
                  <div className="flex-1 bg-[#dbeafe]" />
                  <div className="flex-1 bg-[#60a5fa]" />
                  <div className="flex-1 bg-[#2563eb]" />
                  <div className="flex-1 bg-[#1e3a8a]" />
                </>
              ) : (
                <>
                  <div className="flex-1 bg-[#ede9fe]" />
                  <div className="flex-1 bg-[#a78bfa]" />
                  <div className="flex-1 bg-[#7c3aed]" />
                  <div className="flex-1 bg-[#4c1d95]" />
                </>
              )}
            </div>
            <span className="font-mono text-[11px] font-bold text-zinc-600">{maxVal.toFixed(0)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedDeptObj ? (
            <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50/90 border border-blue-200/80 px-3 py-1.5 text-xs font-semibold text-[#002b7f] shadow-2xs">
              <span className="flex size-1.5 rounded-full bg-[#002b7f]" />
              <span>{selectedDeptObj.name}</span>
              <button
                type="button"
                onClick={() => onSelectDepartment(null)}
                className="ml-1 text-[#ff6a00] font-bold hover:underline"
              >
                (Restablecer Todos)
              </button>
            </div>
          ) : (
            <span className="font-mono text-zinc-500 text-[11px]">
              VISTA GLOBAL · 14 DEPARTAMENTOS
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
