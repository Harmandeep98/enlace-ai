import { createHash } from "node:crypto";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import type { DocumentChunkRepository, EmbeddingPort } from "@enlace/knowledge";

// ~500 tokens per chunk / ~75-token overlap (docs/12-knowledge-architecture.md §3), approximated
// at ~4 characters per token since RecursiveCharacterTextSplitter operates on character counts.
// Overlap raised from the original 200 (10%) to 300 (15%) specifically so a fact split across a
// chunk boundary is more likely to appear whole in at least one neighboring chunk — cheap
// mitigation for imprecise chunk boundaries, paired with the MMR retrieval change in Task 3.
// Shared by every ingestion path (website crawl, file upload) — one splitting/embedding/storage
// implementation, not one per source type.
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 300;

export async function chunkEmbedAndStore(
  embeddingAdapter: EmbeddingPort,
  documentChunks: DocumentChunkRepository,
  workspaceId: string,
  sourceId: string,
  text: string
): Promise<{ success: boolean }> {
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP });
  const chunkTexts = await splitter.splitText(text);
  if (chunkTexts.length === 0) return { success: false };

  const embeddings = await embeddingAdapter.embedBatch(chunkTexts);
  await documentChunks.insertMany(
    workspaceId,
    sourceId,
    chunkTexts.map((content, i) => ({
      content,
      embedding: embeddings[i] ?? [],
      tokenCount: Math.ceil(content.length / 4),
      contentHash: createHash("sha256").update(content).digest("hex")
    }))
  );

  return { success: true };
}
