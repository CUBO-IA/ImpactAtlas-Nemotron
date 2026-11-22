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
  const [activity, setActivity] = useState<string[]>([]);
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
            text: "¡Bienvenido al Asistente Analítico de ImpactAtlas! Pregunta por ingresos, educación, ocupación, metas o acceso financiero. También puedes comparar departamentos y pedir una tabla o un gráfico.",
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
      setActivity([]);
      setError(null);

      // Prepare conversation history (max 10, user and assistant only)
      // Join every text block: narration may be split across several blocks.
      const history = messages
        .filter((m) => m.id !== "welcome-msg")
        .slice(-10)
        .map((m) => ({
          role: m.role,
          text: (m.text ?? m.data?.blocks
            .filter((b) => b.type === "text")
            .map((b) => (b as { text: string }).text)
            .join(" ") ?? "").slice(0, 2000),
        }))
        .filter((h) => h.text.trim().length > 0);

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const assistantId = `asst-${userMsgId}`;
      let completed = false;
      const steps: string[] = [];

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/x-ndjson" },
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

        if (!res.body) throw new Error("La respuesta no contiene datos.");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let pending = "";
        const timestamp = new Date().toLocaleTimeString("es-SV", { hour: "2-digit", minute: "2-digit" });
        while (true) {
          const { value, done } = await reader.read();
          pending += decoder.decode(value, { stream: !done });
          const lines = pending.split("\n");
          pending = lines.pop() ?? "";
          for (const line of lines) {
            if (!line) continue;
            const event = JSON.parse(line);
            if (event.type === "stage") {
              const labels: Record<string, string> = {
                "provider-plan": "Interpretando la pregunta y seleccionando herramientas",
                statistics: "Herramienta: estadísticas",
                compare: "Herramienta: comparación de departamentos",
                semantic: "Herramienta: búsqueda por similitud",
                answer: "Revisando la evidencia y preparando la respuesta",
                metadata: "Preparando información de la consulta",
              };
              steps.push(labels[event.stage] ?? "Procesando consulta");
              setActivity([...steps]);
            } else if (event.type === "text") {
              setMessages((prev) => {
                const existing = prev.find((message) => message.id === assistantId);
                if (existing?.data) return prev.map((message) => {
                  if (message.id !== assistantId || !message.data) return message;
                  const blocks = [...message.data.blocks];
                  const first = blocks[0];
                  if (first?.type === "text") blocks[0] = { ...first, text: first.text + event.text };
                  else blocks.unshift({ type: "text", text: event.text, evidenceIds: [] });
                  return { ...message, data: { ...message.data, blocks } };
                });
                return [...prev, { id: assistantId, role: "assistant", timestamp, data: {
                  status: "answered", blocks: [{ type: "text", text: event.text, evidenceIds: [] }], evidence: [], toolsUsed: [],
                } }];
              });
            } else if (event.type === "block") {
              setMessages((prev) => {
                const existing = prev.find((message) => message.id === assistantId);
                if (existing?.data) return prev.map((message) => message.id === assistantId
                  ? { ...message, data: { ...existing.data!, blocks: [...existing.data!.blocks, event.block] } }
                  : message);
                return [...prev, { id: assistantId, role: "assistant", timestamp, data: {
                  status: "answered", blocks: [event.block], evidence: [], toolsUsed: [],
                } }];
              });
            } else if (event.type === "result") {
              const json: ChatResponse = event.data;
              completed = true;
              setMessages((prev) => [...prev.filter((message) => message.id !== assistantId), {
                id: assistantId, role: "assistant", timestamp, data: json.data, meta: json.meta, activity: [...steps],
              }]);
            } else if (event.type === "error") {
              throw new Error(event.error.message);
            }
          }
          if (done) break;
        }
        if (!completed && !controller.signal.aborted) throw new Error("La respuesta se interrumpió antes de terminar.");
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Error al procesar la respuesta.");
      } finally {
        if (!completed) setMessages((prev) => prev.filter((message) => message.id !== assistantId));
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

        <details className="rounded-2xl border border-blue-100 bg-blue-50/50 px-4 py-3 text-sm text-zinc-700">
          <summary className="cursor-pointer font-semibold text-[#002b7f]">Qué puedo consultar y cómo respondo</summary>
          <div className="mt-3 space-y-2 leading-relaxed">
            <p>Consulto estadísticas agregadas y comparo departamentos. Puedo mostrar tablas o gráficos si los pides.</p>
            <p>El modelo local interpreta tu pregunta y redacta la respuesta. Puede equivocarse: abre «Ver evidencia» para contrastar las cifras con los datos consultados.</p>
            <p>Los resultados describen la muestra, no necesariamente a toda la población. No permiten demostrar causas ni hacer predicciones. La búsqueda por similitud requiere una configuración y validación adicionales.</p>
            <p><Link href={reportHref} className="font-semibold text-[#002b7f] underline">Abrir reportes con estos filtros</Link></p>
          </div>
        </details>

        {/* Message Thread */}
        <div>
          <ChatMessageList messages={messages} loading={loading} activity={activity} />
        </div>

        {/* Error Alert */}
        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 flex items-start gap-3">
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
            showSuggestions={messages.length === 1}
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
