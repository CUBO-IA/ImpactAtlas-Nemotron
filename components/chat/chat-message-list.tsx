"use client";

import React, { useState } from "react";
import Image from "next/image";
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
  Cpu,
  Layers,
  Sparkles,
} from "lucide-react";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text?: string;
  data?: ChatResponse["data"];
  meta?: ChatResponse["meta"];
  timestamp: string;
}

interface ChatMessageListProps {
  messages: Message[];
  loading: boolean;
}

export function ChatMessageList({ messages, loading }: ChatMessageListProps) {
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
              <div className="max-w-2xl rounded-2xl bg-gradient-to-r from-[#002b7f] to-[#001d54] px-5 py-3.5 text-sm text-white shadow-md shadow-[#002b7f]/15">
                <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                <span className="mt-1.5 block text-right font-mono text-[10px] text-blue-200/80">
                  {msg.timestamp}
                </span>
              </div>
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-[#002b7f] shadow-2xs border border-blue-200">
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
            <div className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 text-[#ff6a00] shadow-2xs border border-orange-200">
              <Bot className="size-4.5" />
              <span className="absolute -top-0.5 -right-0.5 flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6a00] opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-[#ff6a00]" />
              </span>
            </div>

            <div className="flex-1 max-w-3xl glass-surface hud-bracket rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
              {/* Status Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200/60 pb-3">
                <div className="flex items-center gap-2">
                  {isAnswered && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200 shadow-2xs">
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                      <span>Respuesta Fundamentada en SQL</span>
                    </span>
                  )}
                  {isClarification && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200 shadow-2xs">
                      <HelpCircle className="size-3.5 text-amber-600" />
                      <span>Aclaración Requerida</span>
                    </span>
                  )}
                  {isInsufficient && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 border border-rose-200 shadow-2xs">
                      <AlertCircle className="size-3.5 text-rose-600" />
                      <span>Muestra Insuficiente ($n &lt; 5$)</span>
                    </span>
                  )}
                </div>

                <span className="font-mono text-[11px] text-zinc-400">{msg.timestamp}</span>
              </div>

              {/* Render Blocks */}
              <div className="space-y-4 text-sm text-zinc-800 leading-relaxed">
                {data.blocks.map((block, idx) => {
                  if (block.type === "text") {
                    return (
                      <div key={idx} className="prose prose-sm max-w-none prose-zinc">
                        {block.text.split("\n\n").map((para, pIdx) => (
                          <p key={pIdx} className="mb-2 leading-relaxed">
                            {para}
                          </p>
                        ))}
                      </div>
                    );
                  }

                  if (block.type === "table") {
                    return (
                      <div
                        key={idx}
                        className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-50/50 shadow-2xs"
                      >
                        {block.title && (
                          <div className="border-b border-zinc-200/70 bg-zinc-100/70 px-4 py-2 text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                            <TableIcon className="size-3.5 text-[#002b7f]" />
                            <span>{block.title}</span>
                          </div>
                        )}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead className="border-b border-zinc-200 bg-white font-mono text-[11px] font-bold uppercase tracking-wider text-zinc-600">
                              <tr>
                                {block.columns.map((col) => (
                                  <th key={col} className="px-4 py-2.5">
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-200/60 bg-white font-sans">
                              {block.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-zinc-50/80 transition-colors">
                                  {row.map((cell, cIdx) => (
                                    <td key={cIdx} className="px-4 py-2.5 font-mono text-zinc-900">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }

                  if (block.type === "chart") {
                    return (
                      <div
                        key={idx}
                        className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-2xs"
                      >
                        <ChartRenderer spec={block.chart} />
                      </div>
                    );
                  }

                  return null;
                })}
              </div>

              {/* Tools Used Pills */}
              {data.toolsUsed && data.toolsUsed.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-zinc-100 text-[11px] text-zinc-500">
                  <span className="font-mono text-zinc-400 font-semibold uppercase">HERRAMIENTAS:</span>
                  {data.toolsUsed.map((tool) => (
                    <span
                      key={tool}
                      className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 font-mono text-[10px] font-medium text-zinc-700"
                    >
                      {tool === "search_semantic_evidence" ? (
                        <Search className="size-2.5 text-[#ff6a00]" />
                      ) : (
                        <Database className="size-2.5 text-[#002b7f]" />
                      )}
                      {tool}
                    </span>
                  ))}
                </div>
              )}

              {/* Evidence Traceability Accordion */}
              {data.evidence && data.evidence.length > 0 && (
                <div className="pt-2 border-t border-zinc-200/60">
                  <button
                    type="button"
                    onClick={() => toggleEvidence(msg.id)}
                    className="flex w-full items-center justify-between rounded-xl bg-zinc-50/80 hover:bg-zinc-100/70 px-3.5 py-2 text-xs font-semibold text-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-600" />
                      <span>Evidencias y Trazabilidad de Hechos ({data.evidence.length})</span>
                    </div>
                    {showEvidence ? (
                      <ChevronUp className="size-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="size-4 text-zinc-400" />
                    )}
                  </button>

                  {showEvidence && (
                    <div className="mt-3 space-y-2.5 pl-2">
                      {data.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3 text-xs space-y-1.5 hover:border-zinc-300 transition-colors"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-mono font-bold text-[#002b7f]">
                              ID: {ev.id} · {ev.kind === "sql_aggregate" ? "Agregación SQL" : "Búsqueda Semántica"}
                            </span>
                            {ev.sampleSize !== null && (
                              <span className="font-mono text-[10px] text-zinc-500">
                                Muestra: {ev.sampleSize.toLocaleString("es-SV")} perfiles
                              </span>
                            )}
                          </div>
                          <p className="text-zinc-700 font-medium">{ev.description}</p>
                          {ev.facts && ev.facts.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1 font-mono text-[10px] text-zinc-600">
                              {ev.facts.map((f) => (
                                <span key={f.id} className="rounded bg-white border border-zinc-200/80 px-2 py-0.5 shadow-2xs">
                                  {f.label}: <strong className="text-zinc-900">{f.value !== null ? f.value : "N/D"} {f.unit}</strong>
                                </span>
                              ))}
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

      {/* Futuristic Typing / Query Execution Indicator */}
      {loading && (
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#ff6a00] animate-pulse">
            <Bot className="size-4.5" />
          </div>
          <div className="glass-surface hud-bracket rounded-2xl px-5 py-3.5 text-xs text-zinc-600 flex items-center gap-3">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#002b7f] opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-[#002b7f]" />
            </span>
            <span className="font-mono font-medium">Ejecutando agregación SQL y búsqueda vectorial en PostgreSQL...</span>
          </div>
        </div>
      )}
    </div>
  );
}
