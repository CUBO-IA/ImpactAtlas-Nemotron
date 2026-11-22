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
  Cpu,
  Layers,
  ArrowRight,
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
      if (selectedSections.length < 5) {
        setSelectedSections([...selectedSections, id]);
      }
    }
  }

  async function handleGeneratePdf() {
    if (generating) return;

    setGenerating(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("/api/reports/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "Reporte de Inclusión Financiera e Impacto Socioeconómico",
          filters: filters,
          indicators: selectedIndicators,
          sections: selectedSections,
        }),
      });

      const contentType = response.headers.get("content-type") || "";

      if (!response.ok || !contentType.includes("application/pdf")) {
        const errorJson = await response.json().catch(() => null);
        throw new Error(
          errorJson?.error?.message ||
            `Error al generar el PDF (${response.status}: ${response.statusText})`
        );
      }

      // Download PDF blob safely and revoke URL
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `reporte-impactatlas-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setSuccess(true);
    } catch (err: unknown) {
      console.error("PDF generation failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado al procesar la exportación del PDF."
      );
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 2-Column Configuration Station */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Card: Indicators Selector */}
        <div className="glass-surface hud-bracket rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-[#002b7f]" />
                <h3 className="text-sm font-extrabold text-zinc-950">
                  Indicadores Estadísticos
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Selecciona entre 1 y 4 variables clave.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-[#002b7f] bg-blue-50/80 px-2.5 py-0.5 rounded-full border border-blue-200/80">
              {selectedIndicators.length} / 4
            </span>
          </div>

          <div className="space-y-2.5">
            {indicatorOptions.map((opt) => {
              const selected = selectedIndicators.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleIndicator(opt.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition-all duration-200 border ${
                    selected
                      ? "border-[#002b7f]/40 bg-blue-50/50 text-zinc-900 shadow-2xs"
                      : "border-zinc-200/80 bg-white/70 hover:border-zinc-300 text-zinc-600"
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
                    <div className="text-xs font-bold text-zinc-900">{opt.label}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Card: Sections Selector */}
        <div className="glass-surface hud-bracket rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-200/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-2 rounded-full bg-[#ff6a00]" />
                <h3 className="text-sm font-extrabold text-zinc-950">
                  Secciones del Informe
                </h3>
              </div>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Selecciona entre 1 y 5 capítulos estructurados.
              </p>
            </div>
            <span className="font-mono text-xs font-bold text-[#ff6a00] bg-orange-50/80 px-2.5 py-0.5 rounded-full border border-orange-200/80">
              {selectedSections.length} / 5
            </span>
          </div>

          <div className="space-y-2.5">
            {sectionOptions.map((opt) => {
              const selected = selectedSections.includes(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleSection(opt.id)}
                  className={`flex w-full items-start gap-3 rounded-2xl p-3.5 text-left transition-all duration-200 border ${
                    selected
                      ? "border-orange-300 bg-orange-50/40 text-zinc-900 shadow-2xs"
                      : "border-zinc-200/80 bg-white/70 hover:border-zinc-300 text-zinc-600"
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
                    <div className="text-xs font-bold text-zinc-900">{opt.label}</div>
                    <div className="text-[11px] text-zinc-500 mt-0.5">{opt.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mandatory Inclusions Notice */}
      <div className="glass-surface rounded-3xl p-5 text-xs text-zinc-600 flex items-start gap-3.5 shadow-2xs">
        <ShieldCheck className="size-5 shrink-0 text-[#002b7f] mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-zinc-900">Inclusiones Institucionales Automáticas:</span>
          <p className="text-[11px] leading-relaxed text-zinc-500">
            Cada informe emitido incorpora de manera obligatoria y no modificable: fecha y hora de emisión ISO, identificador criptográfico de petición (`requestId`), fuentes cartográficas (CNR), notas metodológicas de la cohorte y advertencia explícita de supresión de privacidad ($n &lt; 5$).
          </p>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-900 flex items-start gap-3 shadow-2xs">
          <AlertTriangle className="size-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold">Fallo en la generación:</span>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Success alert */}
      {success && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-4 text-xs text-emerald-900 flex items-center gap-3 shadow-2xs animate-in fade-in duration-300">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
          <span className="font-medium">¡Reporte generado y descargado exitosamente en PDF! Revisa tu bandeja de descargas.</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="glass-surface hud-bracket flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-3xl p-6 shadow-sm">
        <div>
          <div className="text-xs font-bold text-zinc-900">
            Listo para compilar: {selectedSections.length} sección{selectedSections.length > 1 ? "es" : ""}, {selectedIndicators.length} indicador{selectedIndicators.length > 1 ? "es" : ""}
          </div>
          <div className="text-[11px] text-zinc-500 mt-0.5">
            El archivo se procesa en el servidor con motor Chromium headless y gráficos vectoriales SVG.
          </div>
        </div>

        <button
          type="button"
          disabled={generating}
          onClick={handleGeneratePdf}
          className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-[#002b7f] to-[#001d54] px-7 py-3 text-xs font-bold text-white shadow-md shadow-[#002b7f]/20 hover:shadow-lg hover:shadow-[#002b7f]/30 transition-all duration-200 disabled:opacity-50 shrink-0 hover:scale-[1.02] active:scale-[0.98]"
        >
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin text-orange-400" />
              <span>Generando PDF en Servidor...</span>
            </>
          ) : (
            <>
              <Download className="size-4 text-orange-400 transition-transform duration-200 group-hover:translate-y-0.5" />
              <span>Generar y Descargar Reporte PDF</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
