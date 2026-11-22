"use client";

import { DEPARTMENTS } from "@/src/lib/catalog-data";
import type { DepartmentId } from "@/src/contracts/common";
import { Check, Star, AlertCircle, RotateCcw } from "lucide-react";

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
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-900">
              Selección Territorial y Departamento de Referencia
            </h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                isTooFew
                  ? "bg-amber-100 text-amber-800 border border-amber-300"
                  : "bg-blue-50 text-[#002b7f] border border-blue-200"
              }`}
            >
              {selectedIds.length} de 14 seleccionados
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Haga clic para agregar o quitar departamentos. Use la estrella para definir el departamento base de comparación.
          </p>
        </div>

        {/* Presets and Reset */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-zinc-400 mr-1">Preajustes:</span>
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onSelectPresets(preset.ids, preset.ref)}
              className="rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-white transition-colors"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
            title="Restablecer selección predeterminada"
          >
            <RotateCcw className="size-3" />
            Restablecer
          </button>
        </div>
      </div>

      {/* Validation warning if fewer than 2 */}
      {isTooFew && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200">
          <AlertCircle className="size-4 shrink-0 text-amber-600" />
          <span>
            Se requieren <strong>al menos 2 departamentos</strong> para realizar el análisis comparativo. Por favor active al menos un departamento adicional.
          </span>
        </div>
      )}

      {/* Departments Grid */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
        {DEPARTMENTS.map((dept) => {
          const selected = isSelected(dept.id);
          const ref = isReference(dept.id);

          return (
            <div
              key={dept.id}
              className={`relative flex flex-col justify-between rounded-xl p-2.5 transition-all text-xs border ${
                ref
                  ? "border-[#002b7f] bg-blue-50/50 ring-1 ring-[#002b7f]"
                  : selected
                  ? "border-blue-200 bg-blue-50/20"
                  : "border-zinc-200 bg-white hover:border-zinc-300 opacity-70"
              }`}
            >
              <div className="flex items-start justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onToggleDepartment(dept.id)}
                  className="flex items-center gap-1.5 text-left font-semibold text-zinc-900 flex-1 hover:text-[#002b7f] transition-colors"
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      selected
                        ? "bg-[#002b7f] border-[#002b7f] text-white"
                        : "border-zinc-300 bg-white"
                    }`}
                  >
                    {selected && <Check className="size-3 stroke-[3]" />}
                  </span>
                  <span className="truncate">{dept.label}</span>
                </button>
              </div>

              {selected && (
                <div className="mt-2 flex items-center justify-between pt-1 border-t border-zinc-100">
                  {ref ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#002b7f]">
                      <Star className="size-3 fill-[#002b7f]" />
                      Referencia
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSetReference(dept.id)}
                      className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-500 hover:text-[#002b7f] hover:underline transition-colors"
                      title={`Establecer ${dept.label} como departamento de referencia`}
                    >
                      <Star className="size-3" />
                      Fijar base
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
