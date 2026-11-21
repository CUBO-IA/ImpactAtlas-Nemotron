import { z } from "zod";
import {
  breakdownSchema, departmentIdSchema, departmentMetricSchema, filterFields,
  metricIdSchema, response, unique,
} from "./common.ts";
import { metricsSchema, statisticsRowSchema } from "./statistics.ts";

export const compareRequestSchema = z.strictObject({
  departmentIds: unique(departmentIdSchema, 2, 14),
  referenceDepartmentId: departmentIdSchema,
  filters: z.strictObject(filterFields).optional(),
  metrics: unique(departmentMetricSchema, 0, 4),
  breakdowns: unique(breakdownSchema, 0, 3),
}).refine(({ departmentIds, referenceDepartmentId }) => departmentIds.includes(referenceDepartmentId), {
  message: "La referencia debe estar en la selección.", path: ["referenceDepartmentId"],
}).refine(({ metrics, breakdowns }) => metrics.length + breakdowns.length > 0, {
  message: "Se requiere al menos una métrica o distribución.",
});

export const compareResponseSchema = response(z.strictObject({
  referenceDepartmentId: departmentIdSchema,
  departments: z.array(z.strictObject({
    id: departmentIdSchema, label: z.string(), sampleSize: z.number().int().nonnegative().nullable(),
    metrics: metricsSchema,
    differences: z.array(z.strictObject({
      metricId: metricIdSchema, value: z.number().finite().nullable(),
      unit: z.enum(["records", "usd_estimated", "percentage_points"]),
    })),
    breakdowns: z.partialRecord(breakdownSchema, z.array(statisticsRowSchema)),
  })),
}));

export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type CompareResponse = z.infer<typeof compareResponseSchema>;
