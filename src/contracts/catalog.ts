import { z } from "zod";
import { departmentIdSchema, groupBySchema, metricIdSchema, response, unitSchema } from "./common.ts";

const catalogItemSchema = z.strictObject({ id: z.string(), label: z.string() });
export const catalogResponseSchema = response(z.strictObject({
  departments: z.array(z.strictObject({ id: departmentIdSchema, label: z.string(), geoFeatureId: z.string() })),
  education: z.array(catalogItemSchema),
  occupations: z.array(catalogItemSchema),
  goals: z.array(catalogItemSchema),
  indicators: z.array(z.strictObject({
    id: metricIdSchema, label: z.string(), unit: unitSchema,
    allowedGroupBy: z.array(groupBySchema), definition: z.string(),
  })),
  income: z.strictObject({ currency: z.literal("USD"), period: z.string().nullable() }),
  dataset: z.strictObject({
    id: z.string(), version: z.string(), sourceLabel: z.string(),
    collectionPeriod: z.string().nullable(), representative: z.literal(false),
    limitations: z.array(z.string()),
  }),
  privacy: z.strictObject({ minimumPublishableN: z.literal(5) }),
}));

export type CatalogResponse = z.infer<typeof catalogResponseSchema>;
