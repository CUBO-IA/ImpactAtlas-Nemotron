"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { DepartmentId, MetricValue } from "@/src/contracts/common";

export type ActiveMapMetric = "financial_exclusion_pct" | "income_mean" | "sample_count";

interface SvChoroplethMapProps {
  data: Map<string, Record<string, MetricValue>>;
  selectedDepartment: DepartmentId | null;
  onSelectDepartment: (id: DepartmentId | null) => void;
  activeMetric: ActiveMapMetric;
  onChangeMetric: (metric: ActiveMapMetric) => void;
}

const GEOJSON_URL = "/geo/sv-departamentos.geojson";

const style: StyleSpecification = {
  version: 8,
  sources: {
    departments: { type: "geojson", data: GEOJSON_URL },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#f8fafc" } },
    {
      id: "departments-fill",
      type: "fill",
      source: "departments",
      paint: { "fill-color": ["coalesce", ["feature-state", "color"], "#e2e8f0"], "fill-opacity": 0.92 },
    },
    {
      id: "departments-line",
      type: "line",
      source: "departments",
      paint: { "line-color": "#ffffff", "line-width": 1.2 },
    },
    {
      id: "departments-selected",
      type: "line",
      source: "departments",
      filter: ["==", ["get", "departmentId"], ""],
      paint: { "line-color": "#002b7f", "line-width": 3 },
    },
  ],
};

const metricLabels: Record<ActiveMapMetric, string> = {
  financial_exclusion_pct: "Exclusión",
  income_mean: "Ingreso Promedio",
  sample_count: "Muestra",
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]!);
}

export function SvChoroplethMap({
  data,
  selectedDepartment,
  onSelectDepartment,
  activeMetric,
  onChangeMetric,
}: SvChoroplethMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const dataRef = useRef(data);
  const metricRef = useRef(activeMetric);
  const selectionRef = useRef<{ selected: DepartmentId | null; onSelect: (id: DepartmentId | null) => void }>({
    selected: selectedDepartment, onSelect: onSelectDepartment,
  });
  const [readyTick, setReadyTick] = useState(0);
  const [error, setError] = useState(false);

  dataRef.current = data;
  metricRef.current = activeMetric;
  selectionRef.current = { selected: selectedDepartment, onSelect: onSelectDepartment };

  useEffect(() => {
    if (!containerRef.current) return;
    maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        bounds: [[-92.3, 13.1], [-87.6, 14.5]],
        fitBoundsOptions: { padding: 24 },
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
    } catch {
      setError(true);
      return;
    }
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    // El GeoJSON local pesa ~19 MB: reaplicar colores cuando el source termina de cargar.
    map.on("load", () => setReadyTick((tick) => tick + 1));
    map.on("sourcedata", (event) => {
      if (event.sourceId === "departments" && map.isSourceLoaded("departments")) {
        setReadyTick((tick) => tick + 1);
      }
    });
    map.on("error", () => setError(true));

    map.on("click", "departments-fill", (event) => {
      const id = event.features?.[0]?.properties?.departmentId as string | undefined;
      if (!id) return;
      const { selected, onSelect } = selectionRef.current;
      onSelect(selected === id ? null : (id as DepartmentId));
    });

    map.on("mousemove", "departments-fill", (event) => {
      const feature = event.features?.[0];
      const id = feature?.properties?.departmentId as string | undefined;
      if (!id) return;
      const metric = dataRef.current.get(id)?.[metricRef.current];
      const value = metric?.value;
      const text = value === null || value === undefined
        ? "Sin datos"
        : metric?.suppressed
        ? "Suprimido"
        : metricRef.current === "financial_exclusion_pct"
        ? `${value.toFixed(1)}%`
        : metricRef.current === "income_mean"
        ? `$${value.toLocaleString("es-SV", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`
        : `${value.toLocaleString()} perfiles`;
      const name = feature?.properties?.name as string | undefined ?? id;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false })
        .setLngLat(event.lngLat)
        .setHTML(`<strong>${escapeHtml(name)}</strong><br/>${metricLabels[metricRef.current]}: ${escapeHtml(text)}`)
        .addTo(map);
    });
    map.on("mouseleave", "departments-fill", () => {
      popupRef.current?.remove();
      popupRef.current = null;
    });

    return () => {
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
      setReadyTick(0);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyTick) return;
    const published = new Map<string, number>();
    data.forEach((metrics, id) => {
      const value = metrics[activeMetric]?.value;
      if (typeof value === "number" && !metrics[activeMetric]?.suppressed) published.set(id, value);
    });
    const values = [...published.values()];
    const minVal = values.length ? Math.min(...values) : 0;
    const maxVal = values.length ? Math.max(...values) : 100;

    const colors: Record<ActiveMapMetric, string[]> = {
      financial_exclusion_pct: ["#ffedd5", "#fdba74", "#ea580c", "#9a3412"],
      income_mean: ["#dbeafe", "#60a5fa", "#2563eb", "#1e3a8a"],
      sample_count: ["#ede9fe", "#a78bfa", "#7c3aed", "#4c1d95"],
    };
    const ramp = colors[activeMetric];
    const cases: string[] = [];
    for (const [id, metric] of data) {
      const value = metric[activeMetric];
      let color = "#f1f5f9";
      if (value?.suppressed) color = "#e2e8f0";
      else if (typeof value?.value === "number") {
        const ratio = maxVal > minVal ? (value.value - minVal) / (maxVal - minVal) : 0.5;
        color = ramp[Math.min(3, Math.floor(ratio * 4))];
      }
      cases.push(id, color);
    }
    map.setPaintProperty("departments-fill", "fill-color", ["match", ["get", "departmentId"], ...cases, "#e2e8f0"] as never);
  }, [data, activeMetric, readyTick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyTick) return;
    map.setFilter("departments-selected", ["==", ["get", "departmentId"], selectedDepartment ?? ""] as never);
  }, [selectedDepartment, readyTick]);

  const selectedName = data.has(selectedDepartment ?? "") ? selectedDepartment : null;

  return (
    <div className="glass-surface hud-bracket relative rounded-3xl p-6 sm:p-7 flex flex-col transition-all duration-300 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/60">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-500">
              MapLibre · GeoJSON local · 14 departamentos
            </span>
          </div>
          <h2 className="text-base font-extrabold text-zinc-950 flex items-center gap-2">
            Cartografía Coroplética Interactiva
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Selecciona un territorio para activar el visor estadístico o cambia a la vista de tabla accesible.
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-1 text-xs font-semibold text-zinc-600 shadow-2xs">
          {(Object.keys(metricLabels) as ActiveMapMetric[]).map((metric) => (
            <button
              key={metric}
              type="button"
              onClick={() => onChangeMetric(metric)}
              aria-pressed={activeMetric === metric}
              className={`rounded-xl px-3 py-1.5 transition-all duration-200 ${
                activeMetric === metric
                  ? "bg-white font-bold text-[#002b7f] shadow-xs ring-1 ring-zinc-950/5"
                  : "hover:text-zinc-950 hover:bg-white/50"
              }`}
            >
              {metric === "financial_exclusion_pct" ? "Exclusión (%)"
                : metric === "income_mean" ? "Ingreso Promedio ($)" : "Muestra (n)"}
            </button>
          ))}
        </div>
      </div>

      <div className="relative my-4 flex-1 min-h-[380px] rounded-2xl overflow-hidden border border-zinc-200/50 bg-slate-50">
        <div
          ref={containerRef}
          className="maplibre-container"
          style={{ position: "absolute", inset: 0 }}
          role="application"
          aria-label="Mapa coroplético interactivo de El Salvador"
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-zinc-600">
            El mapa no está disponible en este navegador. Usa la vista de tabla accesible para seleccionar departamentos.
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-zinc-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-zinc-500 font-semibold text-[11px] uppercase tracking-wider">Escala:</span>
          <div className="flex h-3 w-32 overflow-hidden rounded-md border border-zinc-300/80 shadow-2xs">
            {(activeMetric === "financial_exclusion_pct"
              ? ["#ffedd5", "#fdba74", "#ea580c", "#9a3412"]
              : activeMetric === "income_mean"
              ? ["#dbeafe", "#60a5fa", "#2563eb", "#1e3a8a"]
              : ["#ede9fe", "#a78bfa", "#7c3aed", "#4c1d95"]
            ).map((color) => <div key={color} className="flex-1" style={{ backgroundColor: color }} />)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedName ? (
            <div className="inline-flex items-center gap-2 rounded-xl bg-blue-50/90 border border-blue-200/80 px-3 py-1.5 text-xs font-semibold text-[#002b7f] shadow-2xs">
              <span className="flex size-1.5 rounded-full bg-[#002b7f]" />
              <span>{selectedDepartment}</span>
              <button
                type="button"
                onClick={() => onSelectDepartment(null)}
                className="ml-1 text-[#ff6a00] font-bold hover:underline"
              >
                (Restablecer Todos)
              </button>
            </div>
          ) : (
            <span className="font-mono text-zinc-500 text-[11px]">VISTA GLOBAL · 14 DEPARTAMENTOS</span>
          )}
        </div>
      </div>
      <p className="sr-only">
        Fuente de las geometrías: Centro Nacional de Registros (CNR), El Salvador. Licencia no declarada en el archivo; verificar procedencia antes de publicación.
      </p>
    </div>
  );
}
