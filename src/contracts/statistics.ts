import { z } from "zod";
import {
  categoryMetricSchema, departmentMetricSchema, filtersSchema, groupBySchema,
  metricIdSchema, metricValueSchema, response, unique,
} from "./common.ts";

export const statisticsRequestSchema = z.strictObject({
  filters: filtersSchema.optional(),
  groupBy: groupBySchema,
  metrics: unique(metricIdSchema, 1, 6),
}).refine(({ groupBy, metrics }) => metrics.every((metric) =>
  (groupBy === "department" ? departmentMetricSchema : categoryMetricSchema).safeParse(metric).success,
), { message: "Métrica no permitida para esta agrupación.", path: ["metrics"] });

export const metricsSchema = z.partialRecord(metricIdSchema, metricValueSchema);
export const statisticsRowSchema = z.strictObject({
  key: z.string(), label: z.string(), sampleSize: z.number().int().nonnegative().nullable(),
  metrics: metricsSchema,
});
export const statisticsResponseSchema = response(z.strictObject({
  groupBy: groupBySchema, rows: z.array(statisticsRowSchema),
}));

export type StatisticsRequest = z.infer<typeof statisticsRequestSchema>;
export type StatisticsResponse = z.infer<typeof statisticsResponseSchema>;
