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

            <div className="flex-1 max-w-3xl rounded-3xl border border-zinc-200 bg-white p-5 shadow-xs space-y-4">
              {/* Status Header Badge */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div className="flex items-center gap-2">
                  {isAnswered && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="size-3.5" />
                      Respuesta Fundamentada en SQL
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
                      Muestra Insuficiente (n &lt; 5)
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
                      <div key={idx} className="leading-relaxed whitespace-pre-wrap">
                        {block.text}
                      </div>
                    );
                  }

                  if (block.type === "table") {
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
                              {block.rows.map((row, rIdx) => (
                                <tr key={rIdx} className="hover:bg-zinc-50/70 transition-colors">
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`py-2 px-3.5 ${
                                        cIdx === 0 ? "font-semibold text-zinc-900 pl-4" : "text-right text-zinc-700"
                                      }`}
                                    >
                                      {cell !== null ? cell.toString() : "—"}
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
                    return <ChartRenderer key={idx} spec={block.chart} />;
                  }

                  return null;
                })}
              </div>

              {/* Evidence Accordion */}
              {data.evidence.length > 0 && (
                <div className="pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => toggleEvidence(msg.id)}
                    className="flex w-full items-center justify-between rounded-xl bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-[#002b7f]" />
                      <span>
                        Trazabilidad y Hechos Verificados ({data.evidence.length} fuente{data.evidence.length > 1 ? "s" : ""})
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
                                  Cálculo SQL Agregado (Exhaustivo sobre cohorte)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[#ff6a00]">
                                  <Search className="size-3.5" />
                                  Ejemplos Semánticos Vectoriales (No exhaustivo)
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">
                              Muestra: {ev.sampleSize !== null ? `${ev.sampleSize.toLocaleString()} reg` : "N/D"}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-600">{ev.description}</p>

                          {ev.facts.length > 0 && (
                            <div className="rounded-lg bg-zinc-50 p-2 border border-zinc-100">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">
                                Hechos certificados en la consulta:
                              </span>
                              <div className="space-y-1">
                                {ev.facts.map((fact) => (
                                  <div
                                    key={fact.id}
                                    className="flex items-center justify-between text-[11px] text-zinc-700"
                                  >
                                    <span className="truncate">{fact.label}</span>
                                    <span className="font-mono font-bold text-zinc-900 shrink-0 ml-2">
                                      {fact.value !== null
                                        ? fact.unit === "usd_estimated"
                                          ? `$${fact.value.toFixed(2)}`
                                          : fact.unit === "percent"
                                          ? `${fact.value.toFixed(1)}%`
                                          : fact.value.toLocaleString("es-SV")
                                        : "N/D"}
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
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-[#ff6a00]">
            <Bot className="size-4 animate-bounce" />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#002b7f]">
              <span className="size-2 rounded-full bg-[#002b7f] animate-ping" />
              Consultando hechos y agregaciones SQL en la base de datos...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
