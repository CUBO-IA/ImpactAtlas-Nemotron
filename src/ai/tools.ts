import { z } from "zod";
import { breakdownSchema, departmentIdSchema, departmentMetricSchema, groupBySchema, unique } from "../contracts/common.ts";
import { metricIdSchema } from "../contracts/common.ts";
import { EDUCATION, GOALS, OCCUPATIONS } from "../lib/catalog-data.ts";

export const cohortFields = {
  occupationId: z.enum(OCCUPATIONS.map(({ id }) => id)).optional(),
  educationId: z.enum(EDUCATION.map(({ id }) => id)).optional(),
  goalId: z.enum(GOALS.map(({ id }) => id)).optional(),
  minIncome: z.number().finite().nonnegative().optional(),
  maxIncome: z.number().finite().nonnegative().optional(),
};

const statsCall = z.strictObject({
  name: z.literal("get_statistics"),
  input: z.strictObject({
    groupBy: groupBySchema,
    metrics: unique(metricIdSchema, 1, 6),
    ...cohortFields,
  }),
});
const compareCall = z.strictObject({
  name: z.literal("compare_departments"),
  input: z.strictObject({
    departmentIds: unique(departmentIdSchema, 2, 14),
    referenceDepartmentId: departmentIdSchema,
    metrics: unique(departmentMetricSchema, 0, 4),
    breakdowns: unique(breakdownSchema, 0, 3),
    ...cohortFields,
  }).refine(({ departmentIds, referenceDepartmentId }) => departmentIds.includes(referenceDepartmentId))
    .refine(({ metrics, breakdowns }) => metrics.length + breakdowns.length > 0),
});
const semanticCall = z.strictObject({
  name: z.literal("search_semantic_evidence"),
  input: z.strictObject({ text: z.string().trim().min(1).max(500), topK: z.number().int().min(1).max(20) }),
});

export const chatPlanSchema = z.discriminatedUnion("status", [
  z.strictObject({
    status: z.literal("answered"),
    text: z.string().trim().min(1).max(4000),
    calls: z.tuple([]),
  }),
  z.strictObject({
    status: z.literal("needs_clarification"),
    question: z.string().trim().min(1).max(500),
    calls: z.tuple([]),
  }),
  z.strictObject({
    status: z.literal("execute"),
    calls: z.array(z.discriminatedUnion("name", [statsCall, compareCall, semanticCall])).min(1).max(1),
  }),
]);
