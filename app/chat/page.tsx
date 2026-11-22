"use client";

import React, { Suspense, useState, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Filters } from "@/src/contracts/common";
import type { ChatResponse } from "@/src/contracts/chat";
import { ChatMessageList, type Message } from "@/components/chat/chat-message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { FilterBar } from "@/components/filters/filter-bar";
import {
  Bot,
  BarChart3,
  GitCompare,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
} from "lucide-react";

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize filters from URL if available
  const initialFilters = React.useMemo(() => {
    const filters: Filters = {};
    const minInc = searchParams.get("minIncome");
    const maxInc = searchParams.get("maxIncome");
    if (minInc || maxInc) {
      filters.income = {
        min: minInc ? parseFloat(minInc) : undefined,
        max: maxInc ? parseFloat(maxInc) : undefined,
      };
    }
    const edu = searchParams.get("education");
    if (edu) filters.educationIds = edu.split(",").filter(Boolean);
    const occ = searchParams.get("occupation");
    if (occ) filters.occupationIds = occ.split(",").filter(Boolean);
    const goal = searchParams.get("goal");
    if (goal) filters.goalIds = goal.split(",").filter(Boolean);
    return filters;
  }, [searchParams]);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial greeting
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-msg",
      role: "assistant",
      timestamp: "Ahora",
      data: {
        status: "answered",
        blocks: [
          {
            type: "text",
            text: "¡Bienvenido al **Asistente Analítico de ImpactAtlas**!\n\nPuedo responder tus preguntas socioeconómicas ejecutando agregaciones SQL directas en PostgreSQL y explorando metas cualitativas con búsqueda semántica vectorial. Cada respuesta incluye su bloque de evidencias trazables con los registros y hechos exactos de la muestra ($N = 50,000$).",
            evidenceIds: [],
          },
        ],
        evidence: [],
        toolsUsed: [],
      },
    },
  ]);

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSendMessage = useCallback(
    async (question: string) => {
      if (loading) return;

      const userMsgId = `user-${Date.now()}`;
      const nowStr = new Date().toLocaleTimeString("es-SV", {
        hour: "2-digit",
        minute: "2-digit",
      });

      // Append user message
      const nextMessages: Message[] = [
        ...messages,
        {
          id: userMsgId,
          role: "user",
          text: question,
          timestamp: nowStr,
        },
      ];

      setMessages(nextMessages);
      setLoading(true);
      setError(null);

      // Prepare conversation history (max 10, user and assistant only)
      const history = nextMessages.slice(-10).map((m) => ({
        role: m.role,
        text: m.text ?? (m.data?.blocks.find((b) => b.type === "text") as { text: string } | undefined)?.text ?? "",
      }));

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            filters: Object.keys(filters).length > 0 ? filters : undefined,
            history,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson?.error?.message ?? `Error en el servidor: ${res.status}`);
        }

        const json: ChatResponse = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: "assistant",
            data: json.data,
            meta: json.meta,
            timestamp: new Date().toLocaleTimeString("es-SV", {
              hour: "2-digit",
              minute: "2-digit",
            }),
          },
        ]);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        console.error("Chat error:", err);
        setError(err instanceof Error ? err.message : "Error al procesar la respuesta.");
      } finally {
        setLoading(false);
      }
    },
    [messages, filters, loading]
  );

  function handleCancel() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setLoading(false);
  }

  const activeFiltersCount =
    (filters.income?.min !== undefined || filters.income?.max !== undefined ? 1 : 0) +
    (filters.educationIds?.length ?? 0) +
    (filters.occupationIds?.length ?? 0) +
    (filters.goalIds?.length ?? 0);

  return (
    <div className="min-h-screen bg-zinc-50/50 text-zinc-900 flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="Logo ImpactAtlas"
              width={140}
              height={36}
              className="h-8 w-auto object-contain"
              priority
            />
          </Link>
          <nav className="hidden items-center gap-6 text-xs font-semibold text-zinc-600 md:flex">
            <Link href="/explorador" className="transition-colors hover:text-[#002b7f]">
              Explorador y Mapa
            </Link>
            <Link href="/comparador" className="transition-colors hover:text-[#002b7f]">
              Comparador Departamental
            </Link>
            <Link
              href="/chat"
              className="text-[#002b7f] font-bold border-b-2 border-[#002b7f] py-5"
            >
              Chat Asistente IA
            </Link>
            <Link href="/reportes" className="transition-colors hover:text-[#002b7f]">
              Reportes PDF
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                activeFiltersCount > 0
                  ? "border-[#002b7f] bg-blue-50 text-[#002b7f]"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              <span>Filtros de Contexto</span>
              {activeFiltersCount > 0 && (
                <span className="size-4 rounded-full bg-[#002b7f] text-[10px] text-white flex items-center justify-center font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showFilters ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 space-y-6">
        {/* Context Filters Collapsible Drawer */}
        {showFilters && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <FilterBar
              filters={filters}
              onChangeFilters={setFilters}
              sampleSize={null}
              loading={loading}
            />
          </div>
        )}

        {/* Hero badge */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#002b7f]">
            <Bot className="size-4" />
            <span>Asistente Respaldado por Evidencia SQL y Vectores</span>
          </div>
          <span className="text-[11px] text-zinc-500">
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filtro(s) activo(s) aplicados a las consultas`
              : "Sin filtros restrictivos (muestra nacional completa)"}
          </span>
        </div>

        {/* Message Thread */}
        <div className="min-h-[420px]">
          <ChatMessageList messages={messages} loading={loading} />
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 text-rose-600 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold">Error en la consulta:</span>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Sticky Input Area */}
        <div className="sticky bottom-4 z-30 pt-2">
          <ChatInput
            onSendMessage={handleSendMessage}
            onCancel={handleCancel}
            loading={loading}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-4 mt-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-900">ImpactAtlas</span>
            <span>• Asistente con evidencia controlada</span>
          </div>
          <p className="text-[11px] text-zinc-400">
            Cifras verificadas directamente en PostgreSQL. Sin alucinación de datos estadísticos.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#002b7f]">
            <Bot className="size-4 animate-bounce" />
            Cargando asistente...
          </div>
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
