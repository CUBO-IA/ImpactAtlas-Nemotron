"use client";

import React, { useState } from "react";
import Markdown from "react-markdown";
import type { ChatResponse } from "@/src/contracts/chat";
import { ChartRenderer } from "./chart-renderer";
import {
  Bot,
  User,
  Database,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  ShieldCheck,
} from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  data?: ChatResponse["data"];
  meta?: ChatResponse["meta"];
  timestamp: string;
}

/** Códigos de unidad del backend → etiquetas legibles en español. */
const UNIT_LABELS: Record<string, string> = {
  records: "registros",
  usd_estimated: "USD estimados",
  percent: "%",
  percentage_points: "puntos porcentuales",
};

const TOOL_LABELS: Record<ChatResponse["data"]["toolsUsed"][number], string> = {
  get_statistics: "Estadísticas",
  compare_departments: "Comparación de departamentos",
  search_semantic_evidence: "Búsqueda por similitud",
};

type TableCell = string | number | null;

function isUnit(cell: TableCell): cell is string {
  return typeof cell === "string" && UNIT_LABELS[cell] !== undefined;
}

function rowUnit(row: TableCell[]): string {
  return row.find(isUnit) ?? "";
}

/** withUnit=false conserva los decimales del tipo de dato sin repetir la unidad de la columna explícita. */
function formatNumber(value: number, unit: string, withUnit = true): string {
  const currency = unit === "usd_estimated";
  const number = value.toLocaleString("es-SV", {
    minimumFractionDigits: currency ? 2 : 0,
    maximumFractionDigits: unit === "percent" ? 1 : 2,
  });
  if (!withUnit) return number;
  if (currency) return `$${number}`;
  if (unit === "percent") return `${number}%`;
  if (unit === "percentage_points") return `${number} pp`;
  return number;
}

function formatCell(cell: TableCell, unit: string, withUnit: boolean): string {
  if (cell === null) return "—";
  if (typeof cell === "number") return formatNumber(cell, unit, withUnit);
  return UNIT_LABELS[cell] ?? cell;
}

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
  stage: string;
}

export function ChatMessageList({ messages, loading, stage }: ChatMessageListProps) {
  const [openEvidence, setOpenEvidence] = useState<Record<string, boolean>>({});

  function toggleEvidence(msgId: string) {
    setOpenEvidence((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  }

  return (
    <div className="space-y-6">
      {messages.map((msg) => {
        const isUser = msg.role === "user";

        if (isUser) {
          return (
            <div key={msg.id} className="flex items-start justify-end gap-3">
              <div className="max-w-2xl rounded-2xl bg-[#002b7f] px-4 py-3 text-sm text-white shadow-xs">
                <p className="whitespace-pre-wrap">{msg.text}</p>
                <span className="mt-1 block text-right text-[10px] text-blue-200">
                  {msg.timestamp}
                </span>
              </div>
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#002b7f]">
                <User className="size-4" />
              </div>
            </div>
          );
        }

        const data = msg.data;
        if (!data) return null;

        const isAnswered = data.status === "answered";
        const isClarification = data.status === "needs_clarification";
        const isInsufficient = data.status === "insufficient_evidence";
        const showEvidence = openEvidence[msg.id] ?? false;

        return (
          <div key={msg.id} className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#ff6a00]">
              <Bot className="size-4" />
            </div>

            <div className="min-w-0 flex-1 max-w-3xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
              {/* Status Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  {isAnswered && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-3.5" />
                      Respuesta
                    </span>
                  )}
                  {isClarification && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                      <HelpCircle className="size-3.5" />
                      Aclaración Requerida
                    </span>
                  )}
                  {isInsufficient && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                      <AlertCircle className="size-3.5" />
                      Evidencia insuficiente
                    </span>
                  )}
                </div>

                <span className="text-[11px] text-zinc-400">{msg.timestamp}</span>
              </div>

              {/* Render Blocks */}
              <div className="space-y-4 text-sm text-zinc-800">
                {data.blocks.map((block, idx) => {
                  if (block.type === "text") {
                    return (
                      <div key={idx} className="leading-relaxed break-words [&_p]:whitespace-pre-wrap [&_p:not(:first-child)]:mt-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 [&_a]:text-blue-700 [&_a]:underline [&_code]:rounded [&_code]:bg-zinc-100 [&_code]:px-1 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-zinc-100 [&_pre]:p-3 [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-300 [&_blockquote]:pl-3 [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold">
                        <Markdown skipHtml disallowedElements={["img"]}>{block.text}</Markdown>
                      </div>
                    );
                  }

                  if (block.type === "table") {
                    const hasUnitColumn = block.columns.some((col) => col.trim().toLowerCase() === "unidad")
                      || block.rows.some((row) => row.some(isUnit));
                    return (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50/50 my-3"
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-200 bg-zinc-100/70 text-xs font-bold text-zinc-900">
                          <TableIcon className="size-3.5 text-[#002b7f]" />
                          {block.title}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-zinc-100/40 text-zinc-600 font-semibold border-b border-zinc-200">
                              <tr>
                                {block.columns.map((col, cIdx) => (
                                  <th
                                    key={cIdx}
                                    className={`py-2.5 px-3.5 ${
                                      cIdx === 0 ? "pl-4" : "text-right"
                                    }`}
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200/60 bg-white">
                              {block.rows.map((row, rIdx) => {
                                const unit = rowUnit(row);
                                return (
                                  <tr key={rIdx} className="hover:bg-zinc-50/70 transition-colors">
                                    {row.map((cell, cIdx) => (
                                      <td
                                        key={cIdx}
                                        className={`py-2 px-3.5 ${
                                          cIdx === 0 ? "font-semibold text-zinc-900 pl-4" : "text-right text-zinc-700"
                                        }`}
                                      >
                                        {formatCell(cell, unit, !hasUnitColumn)}
                                      </td>
                                    ))}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }

                  if (block.type === "chart") {
                    return <ChartRenderer key={idx} spec={block.chart} />;
                  }

                  return null;
                })}
              </div>

              {data.toolsUsed.length > 0 && (
                <p className="text-xs text-zinc-500">
                  Consulta: {[...new Set(data.toolsUsed)].map((tool) => TOOL_LABELS[tool]).join(" · ")}
                </p>
              )}

              {/* Evidence Accordion */}
              {data.evidence.length > 0 && (
                <div className="pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => toggleEvidence(msg.id)}
                    aria-expanded={showEvidence}
                    className="flex w-full items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-[#002b7f]" />
                      <span>
                        Ver evidencia ({data.evidence.length})
                      </span>
                    </div>
                    {showEvidence ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </button>

                  {showEvidence && (
                    <div className="mt-3 space-y-3 pt-1">
                      {data.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-xl border border-zinc-200 bg-white p-3 text-xs space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-zinc-100 pb-2">
                            <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                              {ev.kind === "sql_aggregate" ? (
                                <span className="inline-flex items-center gap-1 text-[#002b7f]">
                                  <Database className="size-3.5" />
                                  Agregación SQL
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[#ff6a00]">
                                  <Search className="size-3.5" />
                                  Evidencia semántica
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">
                              Muestra: {ev.sampleSize !== null ? `${ev.sampleSize.toLocaleString("es-SV")} registros` : "N/D"}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-600">{ev.description}</p>

                          {ev.facts.length > 0 && (
                            <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-100">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                                Valores reportados:
                              </span>
                              <div className="space-y-1">
                                {ev.facts.map((fact) => (
                                  <div
                                    key={fact.id}
                                    className="flex items-center justify-between text-[11px] text-zinc-700"
                                  >
                                    <span className="truncate">{fact.label}</span>
                                    <span className="font-mono font-bold text-zinc-900 shrink-0 ml-2">
                                      {fact.value !== null ? formatNumber(fact.value, fact.unit) : "N/D"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {loading && (
        <div className="flex items-start gap-3" role="status">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#ff6a00]">
            <Bot className="size-4 animate-bounce" />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#002b7f]">
              <span className="size-2 rounded-full bg-[#002b7f] animate-ping" />
              {stage || "Procesando consulta..."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
