import { z } from "zod";

export const departmentIdSchema = z.enum([
  "ahuachapan", "cabanas", "chalatenango", "cuscatlan", "la-libertad",
  "la-paz", "la-union", "morazan", "san-miguel", "san-salvador",
  "san-vicente", "santa-ana", "sonsonate", "usulutan",
]);

export const metricIdSchema = z.enum([
  "sample_count", "income_mean", "income_median",
  "financial_exclusion_pct", "category_count", "category_pct",
]);
export const departmentMetricSchema = metricIdSchema.exclude(["category_count", "category_pct"]);
export const categoryMetricSchema = metricIdSchema.extract(["category_count", "category_pct"]);
export const breakdownSchema = z.enum(["education", "occupation", "goal"]);
export const groupBySchema = z.enum(["department", "education", "occupation", "goal"]);

export function unique<T>(schema: z.ZodType<T>, min: number, max: number) {
  return z.array(schema).min(min).max(max)
    .refine((values) => new Set(values).size === values.length, "No se permiten valores duplicados.");
}

const incomeSchema = z.strictObject({
  min: z.number().finite().nonnegative().optional(),
  max: z.number().finite().nonnegative().optional(),
}).refine(({ min, max }) => min !== undefined || max !== undefined, "Se requiere al menos un extremo.")
  .refine(({ min, max }) => min === undefined || max === undefined || min <= max, "min debe ser menor o igual que max.");

export const filterFields = {
  income: incomeSchema.optional(),
  educationIds: unique(z.string().min(1), 1, 30).optional(),
  occupationIds: unique(z.string().min(1), 1, 30).optional(),
  goalIds: unique(z.string().min(1), 1, 30).optional(),
};

export const filtersSchema = z.strictObject({
  departmentIds: unique(departmentIdSchema, 1, 14).optional(),
  ...filterFields,
});

export const unitSchema = z.enum(["records", "usd_estimated", "percent"]);
export const metricValueSchema = z.strictObject({
  value: z.number().finite().nullable(),
  unit: unitSchema,
  validN: z.number().int().nonnegative().nullable(),
  missingN: z.number().int().nonnegative().nullable(),
  suppressed: z.boolean(),
  reason: z.enum(["empty", "insufficient_sample", "complementary_suppression"]).nullable(),
});
export const metaSchema = z.strictObject({
  requestId: z.string(),
  datasetId: z.string(),
  datasetVersion: z.string(),
  generatedAt: z.iso.datetime(),
  appliedFilters: filtersSchema,
  sampleSize: z.number().int().nonnegative().nullable(),
  warnings: z.array(z.strictObject({ code: z.string(), message: z.string() })),
});
export const response = <T extends z.ZodType>(data: T) => z.strictObject({ data, meta: metaSchema });

export const errorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: z.string(), message: z.string(), fields: z.record(z.string(), z.string()).optional(),
  }),
  requestId: z.string(),
});
export const healthResponseSchema = z.strictObject({ status: z.enum(["ok", "unavailable"]) });

export type DepartmentId = z.infer<typeof departmentIdSchema>;
export type MetricId = z.infer<typeof metricIdSchema>;
export type GroupBy = z.infer<typeof groupBySchema>;
export type Filters = z.infer<typeof filtersSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
