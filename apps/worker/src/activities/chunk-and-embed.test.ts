import { describe, expect, it } from "vitest";
import type { DocumentChunkInput, DocumentChunkRepository, EmbeddingPort } from "@enlace/knowledge";
import { chunkEmbedAndStore } from "./chunk-and-embed.js";

class FakeEmbeddingPort implements EmbeddingPort {
  async embed(): Promise<number[]> {
    throw new Error("not used in this test");
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map(() => [1, 2, 3]);
  }
}

class FakeDocumentChunkRepository implements DocumentChunkRepository {
  public inserted: { workspaceId: string; sourceId: string; chunks: DocumentChunkInput[] }[] = [];
  async insertMany(workspaceId: string, sourceId: string, chunks: DocumentChunkInput[]): Promise<void> {
    this.inserted.push({ workspaceId, sourceId, chunks });
  }
  async findBestMatches(): Promise<{ content: string }[]> {
    throw new Error("not used in this test");
  }
  async countBySource(): Promise<number> {
    throw new Error("not used in this test");
  }
}

describe("chunkEmbedAndStore", () => {
  it("splits text into chunks, embeds them, and stores them via the repository", async () => {
    const embeddingAdapter = new FakeEmbeddingPort();
    const documentChunks = new FakeDocumentChunkRepository();

    const result = await chunkEmbedAndStore(embeddingAdapter, documentChunks, "workspace-1", "source-1", "A short piece of text.");

    expect(result.success).toBe(true);
    expect(documentChunks.inserted).toHaveLength(1);
    expect(documentChunks.inserted[0]?.workspaceId).toBe("workspace-1");
    expect(documentChunks.inserted[0]?.sourceId).toBe("source-1");
    expect(documentChunks.inserted[0]?.chunks[0]?.content).toBe("A short piece of text.");
    expect(documentChunks.inserted[0]?.chunks[0]?.embedding).toEqual([1, 2, 3]);
  });

  it("returns success: false when the text splits into zero chunks", async () => {
    const embeddingAdapter = new FakeEmbeddingPort();
    const documentChunks = new FakeDocumentChunkRepository();

    const result = await chunkEmbedAndStore(embeddingAdapter, documentChunks, "workspace-1", "source-1", "");

    expect(result.success).toBe(false);
    expect(documentChunks.inserted).toHaveLength(0);
  });
});
