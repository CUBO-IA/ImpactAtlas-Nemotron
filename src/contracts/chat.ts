import { z } from "zod";
import { filtersSchema, response } from "./common.ts";

export const chatRequestSchema = z.strictObject({
  question: z.string().trim().min(1).max(2000),
  filters: filtersSchema.optional(),
  history: z.array(z.strictObject({
    role: z.enum(["user", "assistant"]),
    text: z.string().max(2000),
  })).max(10).optional(),
});

export const chartSpecSchema = z.strictObject({
  type: z.enum(["bar", "grouped_bar"]), title: z.string(),
  categories: z.array(z.string()).max(30),
  series: z.array(z.strictObject({
    name: z.string(), values: z.array(z.number().finite().nullable()),
    unit: z.enum(["records", "usd_estimated", "percent", "percentage_points"]),
  })).max(14),
  evidenceIds: z.array(z.string()),
}).refine(({ categories, series }) => series.every(({ values }) => values.length === categories.length), {
  message: "Cada serie debe tener un valor por categoría.", path: ["series"],
});
export const chatResponseSchema = response(z.strictObject({
  status: z.enum(["answered", "needs_clarification", "insufficient_evidence"]),
  blocks: z.array(z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("text"), text: z.string(), evidenceIds: z.array(z.string()) }),
    z.strictObject({
      type: z.literal("table"), title: z.string(), columns: z.array(z.string()),
      rows: z.array(z.array(z.union([z.string(), z.number().finite(), z.null()]))).max(30),
      evidenceIds: z.array(z.string()),
    }),
    z.strictObject({ type: z.literal("chart"), chart: chartSpecSchema }),
  ])),
  evidence: z.array(z.strictObject({
    id: z.string(), kind: z.enum(["sql_aggregate", "semantic_examples"]),
    description: z.string(), filters: filtersSchema, sampleSize: z.number().int().nonnegative().nullable(),
    exhaustive: z.boolean(),
    facts: z.array(z.strictObject({
      id: z.string(), label: z.string(), value: z.number().finite().nullable(), unit: z.string(),
    })),
  })),
  toolsUsed: z.array(z.enum(["get_statistics", "compare_departments", "search_semantic_evidence"])),
}));

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatResponse = z.infer<typeof chatResponseSchema>;
export type ChartSpec = z.infer<typeof chartSpecSchema>;
