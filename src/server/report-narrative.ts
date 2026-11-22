import { generateText } from "ai";
import { z } from "zod";
import type { ReportRequest } from "../contracts/reports.ts";
import { lfm3 } from "../ai/lfm3.ts";
import type { ReportSnapshot } from "./reports.ts";

const MAX_NARRATIVE_MS = 60_000;
const selectionSchema = z.object({
  selections: z.array(z.string().min(1).max(80)).max(3),
}).strict();

const labels = {
  education: "educación",
  occupation: "ocupación",
  goals: "metas",
} as const;

function candidatesFor(snapshot: ReportSnapshot, request: ReportRequest) {
  const candidates: { id: string; text: string }[] = [];
  for (const metric of request.indicators) {
    const fact = snapshot.indicators[metric];
    if (fact && !fact.suppressed && fact.value !== null && Number.isFinite(fact.value)) {
      const value = metric === "sample_count"
        ? Math.round(fact.value).toLocaleString("es-SV")
        : `${fact.value.toLocaleString("es-SV", { maximumFractionDigits: 1 })}${fact.unit === "percent" ? "%" : ""}`;
      const title = {
        sample_count: "Conteo publicado",
        income_mean: "Ingreso promedio estimado",
        income_median: "Ingreso mediano estimado",
        financial_exclusion_pct: "Exclusión financiera",
      }[metric];
      candidates.push({ id: `metric:${metric}`, text: `${title}: ${value}.` });
    }
  }

  for (const section of request.sections) {
    if (section === "summary" || section === "ai_analysis") continue;
    const rows = (snapshot.sections[section] ?? [])
      .filter((row) => !row.suppressed && row.percent !== null && Number.isFinite(row.percent))
      .sort((a, b) => b.percent! - a.percent!);
    const top = rows[0];
    if (top) {
      candidates.push({
        id: `category:${section}`,
        text: `En ${labels[section]}, la mayor proporción publicada corresponde a «${top.label}» (${top.percent!.toLocaleString("es-SV", { maximumFractionDigits: 1 })}%).`,
      });
    }
  }
  return candidates;
}

function parseSelection(text: string) {
  const trimmed = text.trim();
  const fenced = /^```json\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return selectionSchema.safeParse(JSON.parse(fenced?.[1] ?? trimmed));
}

export async function createReportNarrative(
  request: ReportRequest,
  snapshot: ReportSnapshot,
  signal: AbortSignal,
  generate: (input: {
    prompt: string;
    abortSignal: AbortSignal;
  }) => Promise<{ text: string }> = ({ prompt, abortSignal }) =>
    generateText({
      model: lfm3,
      system: "Selecciona hasta 3 hechos relevantes SOLO usando sus identificadores. No redactes afirmaciones ni cifras. Devuelve JSON: {\"selections\":[\"id\"]}. Si no hay selección pertinente, devuelve una lista vacía.",
      prompt,
      temperature: 0,
      maxOutputTokens: 128,
      maxRetries: 0,
      providerOptions: { "transformers-js": { enableThinking: false } },
      abortSignal,
    }),
): Promise<{ paragraphs: string[]; warning?: string }> {
  const candidates = candidatesFor(snapshot, request);
  if (!candidates.length) {
    return { paragraphs: [], warning: "Análisis IA omitido: no hay hechos publicables para resumir." };
  }

  try {
    const modelSignal = AbortSignal.any([signal, AbortSignal.timeout(MAX_NARRATIVE_MS)]);
    const result = await generate({ prompt: JSON.stringify(candidates), abortSignal: modelSignal });
    if (signal.aborted) throw signal.reason;
    const parsed = parseSelection(result.text);
    if (!parsed.success) throw new Error("Invalid local narrative selection");
    const byId = new Map(candidates.map((candidate) => [candidate.id, candidate.text]));
    const paragraphs = [...new Set(parsed.data.selections)]
      .flatMap((id) => byId.has(id) ? [byId.get(id)!] : []);
    return paragraphs.length
      ? { paragraphs }
      : { paragraphs: [], warning: "Análisis IA omitido: Qwen3.5 no seleccionó hechos verificables." };
  } catch (error) {
    if (signal.aborted) throw signal.reason ?? error;
    return { paragraphs: [], warning: "Análisis IA no disponible; se conserva el reporte estadístico." };
  }
}
