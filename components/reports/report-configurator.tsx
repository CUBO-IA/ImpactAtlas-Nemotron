"use client";

import React, { useState } from "react";
import type { Filters, MetricId } from "@/src/contracts/common";
import {
  FileText,
  Download,
  CheckSquare,
  Square,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ShieldCheck,
  BarChart3,
  Sparkles,
} from "lucide-react";

interface ReportConfiguratorProps {
  filters: Filters;
}

type SectionKey = "summary" | "education" | "occupation" | "goals" | "ai_analysis";

export function ReportConfigurator({ filters }: ReportConfiguratorProps) {
  // Indicator selections
  const [selectedIndicators, setSelectedIndicators] = useState<MetricId[]>([
    "sample_count",
    "income_mean",
    "income_median",
    "financial_exclusion_pct",
  ]);

  // Section selections
  const [selectedSections, setSelectedSections] = useState<SectionKey[]>([
    "summary",
    "education",
    "occupation",
    "goals",
    "ai_analysis",
  ]);

  const [generating, setGenerating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  // Indicators catalog
  const indicatorOptions: { id: MetricId; label: string; desc: string }[] = [
    {
      id: "sample_count",
      label: "Tamaño de Muestra (n)",
      desc: "Número de perfiles validados en cada departamento",
    },
    {
      id: "income_mean",
      label: "Ingreso Medio Estimado ($ USD)",
      desc: "Promedio aritmético calculado sobre la cohorte",
    },
    {
      id: "income_median",
      label: "Ingreso Mediano Estimado ($ USD)",
      desc: "Percentil 50 de la distribución salarial",
    },
    {
      id: "financial_exclusion_pct",
      label: "Tasa de Exclusión Financiera (%)",
      desc: "Porcentaje de personas sin acceso a servicios bancarios",
    },
  ];

  // Sections catalog
  const sectionOptions: { id: SectionKey; label: string; desc: string }[] = [
    {
      id: "summary",
      label: "Resumen Ejecutivo e Indicadores Territoriales",
      desc: "Tabla consolidada de departamentos y gráfico comparativo de barras",
    },
    {
      id: "education",
      label: "Desglose por Nivel Educativo",
      desc: "Distribución de los 7 niveles de escolaridad y gráfico porcentual",
    },
    {
      id: "occupation",
      label: "Desglose por Ocupación y Empleo",
      desc: "Top 10 ocupaciones más frecuentes en la cohorte",
    },
    {
      id: "goals",
      label: "Metas y Aspiraciones Socioeconómicas",
      desc: "Distribución de prioridades declaradas de desarrollo personal",
    },
    {
      id: "ai_analysis",
      label: "Análisis Asistido por IA y Recomendaciones",
      desc: "Diagnóstico sintetizado a partir de hechos SQL certificados",
    },
  ];

  function toggleIndicator(id: MetricId) {
    if (selectedIndicators.includes(id)) {
      if (selectedIndicators.length > 1) {
        setSelectedIndicators(selectedIndicators.filter((item) => item !== id));
      }
    } else {
      if (selectedIndicators.length < 4) {
        setSelectedIndicators([...selectedIndicators, id]);
      }
    }
  }

  function toggleSection(id: SectionKey) {
    if (selectedSections.includes(id)) {
      if (selectedSections.length > 1) {
        setSelectedSections(selectedSections.filter((item) => item !== id));
      }
    } else {
      setSelectedSections([...selectedSections, id]);
    }
  }

  async function handleGeneratePdf() {
    if (generating) return; // Prevent double submission (D1-13)

    setGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      const payload = {
        filters: Object.keys(filters).length > 0 ? filters : undefined,
        indicators: selectedIndicators,
        sections: selectedSections,
      };

      const res = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Verify that response is binary PDF and not a JSON error (D1-13)
      const contentType = res.headers.get("Content-Type") ?? "";

      if (!res.ok || !contentType.includes("application/pdf")) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.error?.message ?? "Error al generar el documento PDF.");
      }

      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);

      // Trigger automatic browser download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `impactatlas-reporte-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Immediately revoke object URL (D1-13)
      URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
      setTimeout(() => setSuccess(false), 6000);
    } catch (err: unknown) {
      console.error("PDF download failed:", err);
      setError(err instanceof Error ? err.message : "Error durante la generación del reporte.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Indicators Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[#002b7f]" />
              <h3 className="text-sm font-bold text-zinc-900">
                Indicadores a Incluir ({selectedIndicators.length}/4)
              </h3>
            </div>
            <span className="text-[11px] text-zinc-400">Mínimo 1, Máximo 4</span>
          </div>

          <div className="space-y-2">
            {indicatorOptions.map((opt) => {
              const selected = selectedIndicators.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleIndicator(opt.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-all border ${
                    selected
                      ? "border-blue-200 bg-blue-50/40 text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600"
                  }`}
                >
                  <span className="mt-0.5 text-[#002b7f]">
                    {selected ? (
                      <CheckSquare className="size-4" />
                    ) : (
                      <Square className="size-4 text-zinc-300" />
                    )}
                  </span>
                  <div>
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sections Card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-[#ff6a00]" />
              <h3 className="text-sm font-bold text-zinc-900">
                Secciones del Informe ({selectedSections.length}/5)
              </h3>
            </div>
            <span className="text-[11px] text-zinc-400">Mínimo 1 sección</span>
          </div>

          <div className="space-y-2">
            {sectionOptions.map((opt) => {
              const selected = selectedSections.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleSection(opt.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition-all border ${
                    selected
                      ? "border-orange-200 bg-orange-50/30 text-zinc-900"
                      : "border-zinc-200 bg-white hover:border-zinc-300 text-zinc-600"
                  }`}
                >
                  <span className="mt-0.5 text-[#ff6a00]">
                    {selected ? (
                      <CheckSquare className="size-4" />
                    ) : (
                      <Square className="size-4 text-zinc-300" />
                    )}
                  </span>
                  <div>
                    <div className="text-xs font-bold">{opt.label}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mandatory Inclusions Notice (D1-13: Fuentes y limitaciones no son opcionales) */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600 flex items-start gap-3">
        <ShieldCheck className="size-5 shrink-0 text-[#002b7f] mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-zinc-900">Inclusiones Obligatorias del Sistema:</span>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Cada informe emitido incorpora de manera automática y no modificable: fecha y hora de emisión, identificador criptográfico de petición, fuentes cartográficas (CNR), notas metodológicas de la muestra y advertencia explícita de supresión de privacidad ($n &lt; 5$).
          </p>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 flex items-start gap-3">
          <AlertTriangle className="size-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Fallo en la generación:</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Success alert */}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span>¡Reporte generado y descargado exitosamente! Revisa tu carpeta de descargas.</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl border border-zinc-200 bg-white p-5 shadow-xs">
        <div>
          <div className="text-xs font-bold text-zinc-900">
            Listo para generar: {selectedSections.length} sección{selectedSections.length > 1 ? "es" : ""}, {selectedIndicators.length} indicador{selectedIndicators.length > 1 ? "es" : ""}
          </div>
          <div className="text-[11px] text-zinc-500">
            El archivo se procesa en el servidor con motor Chromium headless y gráficos vectoriales SVG.
          </div>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={handleGeneratePdf}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#002b7f] px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-[#002060] transition-all disabled:opacity-50 shrink-0"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>Generando PDF en Servidor...</span>
            </>
          ) : (
            <>
              <Download className="size-4" />
              <span>Generar y Descargar Reporte PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
