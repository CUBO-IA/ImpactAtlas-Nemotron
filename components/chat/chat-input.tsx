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
      {/* Suggestions Pills with Hover Glow */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold uppercase text-zinc-500 mr-1">
          <Sparkles className="size-3 text-[#ff6a00]" />
          Sugerencias:
        </span>
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            disabled={loading}
            onClick={() => handleSelectPreset(preset)}
            className="rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-600 hover:border-[#ff6a00]/40 hover:text-[#002b7f] hover:bg-zinc-50 transition-all duration-200 disabled:opacity-50 text-left truncate max-w-xs shadow-2xs hover:scale-[1.01] active:scale-[0.99]"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Input Box - Futuristic Capsule */}
      <form
        onSubmit={handleSubmit}
        className="glass-surface hud-bracket relative rounded-3xl p-3 shadow-md focus-within:border-[#002b7f] focus-within:ring-2 focus-within:ring-[#002b7f]/15 transition-all duration-300"
      >
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribe tu consulta analítica sobre ingresos, brechas territoriales, metas o exclusión..."
          disabled={loading}
          maxLength={2000}
          className="w-full resize-none border-0 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-0 leading-relaxed"
        />

        <div className="flex items-center justify-between border-t border-zinc-100 px-3 pt-2.5">
          <span className="font-mono text-[10px] text-zinc-400">
            {text.length} / 2000 caracteres · Enter para enviar, Shift+Enter para salto
          </span>

          <div className="flex items-center gap-2">
            {loading ? (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 transition-colors shadow-2xs"
              >
                <XCircle className="size-3.5 text-rose-600" />
                <span>Cancelar consulta</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!text.trim()}
                className="group inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#002b7f] to-[#001d54] px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:shadow-[#002b7f]/20 transition-all duration-200 disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Consultar</span>
                <Send className="size-3 text-orange-400 transition-transform duration-200 group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
