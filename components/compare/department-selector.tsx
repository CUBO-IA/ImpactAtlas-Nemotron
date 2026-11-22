"use client";

import { DEPARTMENTS } from "@/src/lib/catalog-data";
import type { DepartmentId } from "@/src/contracts/common";
import { Check, Star, AlertCircle, RotateCcw, MapPin, Sparkles } from "lucide-react";

interface DepartmentSelectorProps {
  selectedIds: DepartmentId[];
  referenceId: DepartmentId;
  onToggleDepartment: (id: DepartmentId) => void;
  onSetReference: (id: DepartmentId) => void;
  onSelectPresets: (ids: DepartmentId[], newRef?: DepartmentId) => void;
  onReset: () => void;
}

export function DepartmentSelector({
  selectedIds,
  referenceId,
  onToggleDepartment,
  onSetReference,
  onSelectPresets,
  onReset,
}: DepartmentSelectorProps) {
  const isSelected = (id: DepartmentId) => selectedIds.includes(id);
  const isReference = (id: DepartmentId) => referenceId === id;
  const isTooFew = selectedIds.length < 2;

  const presets = [
    {
      label: "Zona Central",
      ids: ["san-salvador", "la-libertad", "cuscatlan"] as DepartmentId[],
      ref: "san-salvador" as DepartmentId,
    },
    {
      label: "Occidente",
      ids: ["santa-ana", "sonsonate", "ahuachapan"] as DepartmentId[],
      ref: "santa-ana" as DepartmentId,
    },
    {
      label: "Oriente",
      ids: ["san-miguel", "usulutan", "la-union", "morazan"] as DepartmentId[],
      ref: "san-miguel" as DepartmentId,
    },
    {
      label: "Todos (14)",
      ids: DEPARTMENTS.map((d) => d.id),
      ref: "san-salvador" as DepartmentId,
    },
  ];

  return (
    <div className="glass-surface hud-bracket rounded-3xl p-6 shadow-sm transition-all duration-300">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-extrabold text-zinc-950">
              Selección Territorial y Territorio Base
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-mono font-bold shadow-2xs ${
                isTooFew
                  ? "bg-amber-100 text-amber-900 border border-amber-300"
                  : "bg-blue-50 text-[#002b7f] border border-blue-200"
              }`}
            >
              {selectedIds.length} / 14 activos
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Selecciona de 2 a 14 departamentos. Usa la estrella dorada para fijar el territorio de referencia para el cálculo de brechas.
          </p>
        </div>

        {/* Presets and Reset */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] font-semibold text-zinc-400 mr-1 uppercase">ZONAS:</span>
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onSelectPresets(preset.ids, preset.ref)}
              className="rounded-xl border border-zinc-200/80 bg-zinc-50/80 px-2.5 py-1 text-xs font-semibold text-zinc-700 hover:border-[#002b7f]/30 hover:bg-white hover:text-[#002b7f] transition-all shadow-2xs active:scale-95"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="group inline-flex items-center gap-1 rounded-xl border border-zinc-200/80 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-600 hover:text-zinc-950 transition-all shadow-2xs active:scale-95"
            title="Restablecer selección predeterminada"
          >
            <RotateCcw className="size-3 transition-transform group-hover:-rotate-90 duration-300" />
            <span>Restablecer</span>
          </button>
        </div>
      </div>

      {/* Validation warning if fewer than 2 */}
      {isTooFew && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs font-semibold text-amber-900 shadow-2xs">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>
            Se requieren al menos 2 departamentos para realizar el análisis comparativo de brechas.
          </span>
        </div>
      )}

      {/* Department Chips Matrix */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {DEPARTMENTS.map((dept) => {
          const selected = isSelected(dept.id);
          const reference = isReference(dept.id);

          return (
            <div
              key={dept.id}
              className={`relative flex items-center justify-between rounded-xl border p-2 text-xs transition-all duration-200 ${
                reference
                  ? "border-orange-500 bg-gradient-to-r from-orange-50/90 to-amber-50/90 text-orange-950 font-bold shadow-xs ring-2 ring-orange-400/30"
                  : selected
                  ? "border-[#002b7f]/40 bg-blue-50/70 text-[#002b7f] font-semibold shadow-2xs"
                  : "border-zinc-200/80 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50/70"
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleDepartment(dept.id)}
                className="flex flex-1 items-center gap-1.5 text-left truncate mr-1"
                title={`${selected ? "Quitar" : "Agregar"} ${dept.label}`}
              >
                <div
                  className={`flex size-4 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    selected
                      ? "border-[#002b7f] bg-[#002b7f] text-white"
                      : "border-zinc-300 bg-white"
                  }`}
                >
                  {selected && <Check className="size-3 stroke-[3]" />}
                </div>
                <span className="truncate">{dept.label}</span>
              </button>

              {/* Set as Reference Star button */}
              {selected && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetReference(dept.id);
                  }}
                  className={`p-1 rounded-lg transition-all ${
                    reference
                      ? "text-orange-500 scale-110"
                      : "text-zinc-300 hover:text-orange-400 hover:bg-orange-50/60"
                  }`}
                  title={
                    reference
                      ? "Territorio de referencia actual"
                      : `Fijar ${dept.label} como referencia base`
                  }
                >
                  <Star
                    className={`size-3.5 ${
                      reference ? "fill-orange-500 text-orange-500" : ""
                    }`}
                  />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
