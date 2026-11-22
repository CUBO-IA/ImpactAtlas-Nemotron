"use client";

import React, { Suspense, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Filters } from "@/src/contracts/common";
import { departmentIdSchema } from "@/src/contracts/common";
import type { ChatResponse } from "@/src/contracts/chat";
import { ChatMessageList, type Message } from "@/components/chat/chat-message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { FilterBar } from "@/components/filters/filter-bar";
import { filterSearchParams } from "@/src/lib/filter-url";
import { SiteHeader } from "@/components/navigation/site-header";
import { SiteFooter } from "@/components/navigation/site-footer";
import {
  Bot,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";

function ChatContent() {
  const searchParams = useSearchParams();

  // Initialize filters from URL if available
  const initialFilters = React.useMemo(() => {
    const filters: Filters = {};
    const departments = searchParams.get("depts")?.split(",") ?? [];
    const validDepartments = departments.filter((id) => departmentIdSchema.safeParse(id).success);
    if (validDepartments.length) {
      filters.departmentIds = [...new Set(validDepartments)] as Filters["departmentIds"];
    }
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
            text: "¡Bienvenido al Asistente Analítico de ImpactAtlas! Escribe una pregunta sobre los datos disponibles. Las respuestas dependen de las capacidades habilitadas y de la evidencia que devuelva el servicio.",
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
      const history = messages.filter((m) => m.id !== "welcome-msg").slice(-10).map((m) => ({
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
        if (controller.signal.aborted) return;

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
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
          setLoading(false);
        }
      }
    },
    [messages, filters, loading]
  );

  function handleCancel() {
    abortControllerRef.current?.abort();
    setLoading(false);
  }

  const activeFiltersCount =
    (filters.departmentIds?.length ?? 0) +
    (filters.income?.min !== undefined || filters.income?.max !== undefined ? 1 : 0) +
    (filters.educationIds?.length ?? 0) +
    (filters.occupationIds?.length ?? 0) +
    (filters.goalIds?.length ?? 0);
  const reportParams = filterSearchParams(filters);
  if (filters.departmentIds?.length) reportParams.set("depts", filters.departmentIds.join(","));
  const reportHref = `/reportes${reportParams.size ? `?${reportParams.toString()}` : ""}`;

  return (
    <div className="flex min-h-screen flex-col bg-white text-zinc-900 font-sans">
      <SiteHeader />
      {/* Main Container */}
      <main className="relative mx-auto w-full max-w-4xl flex-1 px-6 py-8 sm:px-8 space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-200/60 pb-4">
          <h1 className="text-2xl font-bold text-zinc-950">Chat & Consultas</h1>
          <button type="button" onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700">
            <SlidersHorizontal className="size-3.5" /> Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
            {showFilters ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        </div>
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

        <div className="flex justify-end"><Link href={reportHref} className="text-xs font-semibold text-[#002b7f] hover:underline">Abrir reportes con estos filtros</Link></div>

        {/* Hero badge */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-[#002b7f]">
            <Bot className="size-4" />
            <span>Asistente Analítico</span>
          </div>
          <span className="text-[11px] text-zinc-500">
            {activeFiltersCount > 0
              ? `${activeFiltersCount} filtro(s) activo(s) aplicados a las consultas`
              : "Sin filtros departamentales activos"}
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

      <SiteFooter />
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
