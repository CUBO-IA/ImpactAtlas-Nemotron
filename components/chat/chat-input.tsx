"use client";

import React, { useState } from "react";
import { Send, XCircle, Sparkles } from "lucide-react";

interface ChatInputProps {
  onSendMessage: (question: string) => void;
  onCancel: () => void;
  loading: boolean;
}

export function ChatInput({ onSendMessage, onCancel, loading }: ChatInputProps) {
  const [text, setText] = useState("");

  const presets = [
    "¿Cómo se comparan los ingresos entre Santa Ana y San Salvador?",
    "¿Qué metas aparecen en los datos disponibles?",
    "¿Qué departamentos tienen las mayores tasas de exclusión financiera?",
    "Ver distribución por nivel educativo y porcentaje",
  ];

  function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!text.trim() || loading) return;

    onSendMessage(text.trim());
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleSelectPreset(preset: string) {
    if (loading) return;
    onSendMessage(preset);
  }

  return (
    <div className="space-y-3">
      {/* Suggestions Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-400 mr-1">
          <Sparkles className="size-3 text-[#ff6a00]" />
          Sugerencias:
        </span>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={loading}
            onClick={() => handleSelectPreset(preset)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-600 hover:border-[#002b7f] hover:text-[#002b7f] transition-all disabled:opacity-50 text-left truncate max-w-xs shadow-2xs"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Input Box */}
      <form onSubmit={handleSubmit} className="relative rounded-3xl border border-zinc-200 bg-white p-2 shadow-sm focus-within:border-[#002b7f] focus-within:ring-1 focus-within:ring-[#002b7f] transition-all">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu consulta sobre ingresos, departamentos, metas o exclusión financiera..."
          disabled={loading}
          maxLength={2000}
          className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0"
        />

        <div className="flex items-center justify-between border-t border-zinc-100 px-3 pt-2">
          <span className="text-[10px] text-zinc-400">
            {text.length} / 2000 caracteres • Enter para enviar, Shift+Enter para salto de línea
          </span>

          <div className="flex items-center gap-2">
            {loading ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors"
              >
                <XCircle className="size-3.5 text-rose-600" />
                Cancelar consulta
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#002b7f] px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#002060] transition-colors disabled:opacity-40"
              >
                <Send className="size-3.5" />
                Consultar
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
