"use client";

import React from "react";
import type { ChartSpec } from "@/src/contracts/chat";
import { formatChartValue } from "@/src/charts/chart-spec";

interface ChartRendererProps {
  spec: ChartSpec;
}

export function ChartRenderer({ spec }: ChartRendererProps) {
  const { title, categories, series } = spec;

  // Determine max value for scaling
  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const maxValue = allValues.length > 0 ? Math.max(...allValues, 1) : 100;

  const colors = [
    "#002b7f", // Navy
    "#ff6a00", // Orange
    "#10b981", // Emerald
    "#8b5cf6", // Purple
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4 my-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-100 pb-3">
        <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
          {title}
        </h4>
        {series.length > 1 && (
          <div className="flex flex-wrap items-center gap-3 text-[11px]">
            {series.map((s, idx) => (
              <div key={s.name} className="flex items-center gap-1.5 font-medium text-zinc-600">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: colors[idx % colors.length] }}
                />
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SVG Bar Chart Visualization */}
      <div className="space-y-3 pt-2">
        {categories.map((category, catIdx) => (
          <div key={category} className="space-y-1.5">
            <div className="text-xs font-semibold text-zinc-700 truncate">{category}</div>
            <div className="space-y-1">
              {series.map((s, sIdx) => {
                const val = s.values[catIdx];
                const pctWidth = val !== null ? Math.max(3, Math.min(100, (val / maxValue) * 100)) : 0;
                const color = colors[sIdx % colors.length];

                return (
                  <div key={s.name} className="flex items-center gap-3 text-xs">
                    <div className="h-4 flex-1 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                        style={{
                          width: `${pctWidth}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span className="w-24 text-right font-bold text-zinc-800 text-[11px] shrink-0">
                      {formatChartValue(val, s.unit)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
