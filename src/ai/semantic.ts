import { embed, queryText } from "./embeddings.ts";
import { searchSemantic, semanticSearchEnabled } from "../db/queries/semantic.ts";
import type { AuditedCatalog } from "../data/catalog.ts";
import type { Filters } from "../contracts/common.ts";

/**
 * Chat-facing API. Returns without loading the embedding model unless the
 * audited compatibility gate is enabled. Only the question is embedded locally.
 */
export async function searchSemanticForChat(
  question: string,
  catalog: AuditedCatalog,
  filters: Filters = {},
  topK = 20,
) {
  if (!semanticSearchEnabled()) {
    return { status: "abstained" as const, reason: "semantic_compatibility_unverified" as const };
  }
  const [vector] = await embed(queryText(question));
  return searchSemantic(vector, catalog, filters, topK);
}
