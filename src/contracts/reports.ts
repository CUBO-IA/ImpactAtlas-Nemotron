import { z } from "zod";
import { departmentMetricSchema, filtersSchema, unique } from "./common.ts";

export const reportRequestSchema = z.strictObject({
  filters: filtersSchema.optional(),
  indicators: unique(departmentMetricSchema, 1, 4),
  sections: unique(z.enum(["summary", "education", "occupation", "goals", "ai_analysis"]), 1, 5),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;
