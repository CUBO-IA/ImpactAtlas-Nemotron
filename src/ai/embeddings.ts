import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

const model = process.env.EMBEDDING_MODEL ?? "onnx-community/embeddinggemma-2-ONNX";

// ponytail: one shared q4/CPU pipeline, created only when semantic search is actually used
let extractor: FeatureExtractionPipeline | undefined;
async function getExtractor() {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", model, { device: "cpu", dtype: "q4" }) as FeatureExtractionPipeline;
  }
  return extractor;
}

/** Prefixes recommended by the model card for asymmetric search. */
export const queryText = (text: string) => `task: search result | query: ${text}`;
export const documentText = (text: string, title = "none") => `title: ${title} | text: ${text}`;

/** Mean-pooled, L2-normalized embeddings, ready to persist (768 floats each). */
export async function embed(texts: string | string[]): Promise<number[][]> {
  const output = await (await getExtractor())(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
}
