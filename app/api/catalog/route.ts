import { catalogResponseSchema } from "../../../src/contracts/catalog.ts";
import {
  DEPARTMENTS,
  EDUCATION,
  OCCUPATIONS,
  GOALS,
  INDICATORS,
} from "../../../src/lib/catalog-data.ts";

export async function GET() {
  const payload = {
    data: {
      departments: DEPARTMENTS,
      education: EDUCATION,
      occupations: OCCUPATIONS,
      goals: GOALS,
      indicators: INDICATORS,
      income: {
        currency: "USD" as const,
        period: "Mensual estimado",
      },
      dataset: {
        id: "sv-nemotron",
        version: "20261121",
        sourceLabel: "Muestra socioeconómica de El Salvador",
        collectionPeriod: "2026",
        representative: false as const,
        limitations: [
          "Muestra para análisis socioeconómico e inclusión financiera.",
          "No sustituye censos oficiales ni encuestas de hogares.",
          "Los ingresos son estimaciones numéricas aproximadas.",
        ],
      },
      privacy: {
        minimumPublishableN: 5 as const,
      },
    },
    meta: {
      requestId: crypto.randomUUID(),
      datasetId: "sv-nemotron",
      datasetVersion: "20261121",
      generatedAt: new Date().toISOString(),
      appliedFilters: {},
      sampleSize: null,
      warnings: [
        {
          code: "NON_REPRESENTATIVE_SAMPLE",
          message: "Datos de muestra sintética; no necesariamente representativos a nivel nacional.",
        },
      ],
    },
  };

  const parsed = catalogResponseSchema.parse(payload);

  return Response.json(parsed, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
