import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import type { EmbeddingPort } from "../application/ports.js";
import { PrismaKnowledgeSourceRepository } from "./prisma-knowledge-source-repository.js";
import { PrismaDocumentChunkRepository } from "./prisma-document-chunk-repository.js";

function fillVector(value: number): number[] {
  return new Array(768).fill(value);
}

// Deterministic and orthogonal to fillVector(1) — dot product is 0 for a 768-length (even)
// array, so cosine similarity between them is 0 (same technique already used for
// PrismaSemanticCacheRepository's tests).
function alternatingVector(): number[] {
  return new Array(768).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1));
}

class FakeEmbeddingPort implements EmbeddingPort {
  constructor(private readonly vectors: Map<string, number[]>) {}
  async embed(text: string): Promise<number[]> {
    return this.vectors.get(text) ?? fillVector(0);
  }
  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

describe("PrismaDocumentChunkRepository", () => {
  const sources = new PrismaKnowledgeSourceRepository();

  async function makeWorkspaceAndSource() {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const source = await sources.create({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" });
    return { workspace, source };
  }

  afterEach(async () => {
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("inserts chunks and they're readable back for the workspace", async () => {
    const { workspace, source } = await makeWorkspaceAndSource();
    const chunks = new PrismaDocumentChunkRepository(new FakeEmbeddingPort(new Map()));

    await chunks.insertMany(workspace.id, source.id, [
      { content: "First chunk.", embedding: fillVector(1), tokenCount: 3, contentHash: "hash-1" },
      { content: "Second chunk.", embedding: fillVector(2), tokenCount: 3, contentHash: "hash-2" }
    ]);

    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.$queryRaw<{ content: string }[]>`
        SELECT content FROM document_chunks WHERE "sourceId" = ${source.id} ORDER BY content
      `;
    });

    expect(rows.map((r) => r.content)).toEqual(["First chunk.", "Second chunk."]);
  });

  // docs/21-testing-strategy.md §5 — id-only query, so only RLS (not an app-level filter) can hide the row.
  it("RLS blocks reading another workspace's chunk even with an id-only query", async () => {
    const { workspace: workspaceA, source: sourceA } = await makeWorkspaceAndSource();
    const chunks = new PrismaDocumentChunkRepository(new FakeEmbeddingPort(new Map()));
    await chunks.insertMany(workspaceA.id, sourceA.id, [
      { content: "A's chunk.", embedding: fillVector(1), tokenCount: 3, contentHash: "hash-a" }
    ]);
    const [entryA] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceA.id}, true)`;
      return tx.$queryRaw<{ id: string }[]>`SELECT id FROM document_chunks WHERE "sourceId" = ${sourceA.id}`;
    });
    if (!entryA) throw new Error("expected an inserted chunk");
    const workspaceB = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });

    const rowsVisibleFromB = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceB.id}, true)`;
      return tx.$queryRaw<{ id: string }[]>`SELECT id FROM document_chunks WHERE id = ${entryA.id}`;
    });

    expect(rowsVisibleFromB).toHaveLength(0);
  });

  describe("countBySource", () => {
    it("counts chunks belonging to a source", async () => {
      const { workspace, source } = await makeWorkspaceAndSource();
      const chunks = new PrismaDocumentChunkRepository(new FakeEmbeddingPort(new Map()));
      await chunks.insertMany(workspace.id, source.id, [
        { content: "First chunk.", embedding: fillVector(1), tokenCount: 3, contentHash: "hash-1" },
        { content: "Second chunk.", embedding: fillVector(2), tokenCount: 3, contentHash: "hash-2" }
      ]);

      const count = await chunks.countBySource(source.id, workspace.id);

      expect(count).toBe(2);
    });

    it("returns 0 for a source with no chunks", async () => {
      const { workspace, source } = await makeWorkspaceAndSource();
      const chunks = new PrismaDocumentChunkRepository(new FakeEmbeddingPort(new Map()));

      const count = await chunks.countBySource(source.id, workspace.id);

      expect(count).toBe(0);
    });
  });

  describe("findBestMatches", () => {
    it("returns matching chunks from a Ready source", async () => {
      const { workspace, source } = await makeWorkspaceAndSource();
      await sources.updateSyncStatus(source.id, workspace.id, "Ready", new Date());
      const embeddings = new FakeEmbeddingPort(
        new Map([
          ["Our business hours are 9am to 5pm.", fillVector(1)],
          ["What are your business hours?", fillVector(1)]
        ])
      );
      const chunks = new PrismaDocumentChunkRepository(embeddings);
      await chunks.insertMany(workspace.id, source.id, [
        { content: "Our business hours are 9am to 5pm.", embedding: fillVector(1), tokenCount: 8, contentHash: "hash-1" }
      ]);

      const matches = await chunks.findBestMatches(workspace.id, "What are your business hours?", 3);

      expect(matches).toEqual([{ content: "Our business hours are 9am to 5pm." }]);
    });

    it("does not return chunks from a source that isn't Ready", async () => {
      const { workspace, source } = await makeWorkspaceAndSource();
      // Left at the default "Pending" status — never marked Ready.
      const embeddings = new FakeEmbeddingPort(
        new Map([
          ["Our business hours are 9am to 5pm.", fillVector(1)],
          ["What are your business hours?", fillVector(1)]
        ])
      );
      const chunks = new PrismaDocumentChunkRepository(embeddings);
      await chunks.insertMany(workspace.id, source.id, [
        { content: "Our business hours are 9am to 5pm.", embedding: fillVector(1), tokenCount: 8, contentHash: "hash-1" }
      ]);

      const matches = await chunks.findBestMatches(workspace.id, "What are your business hours?", 3);

      expect(matches).toEqual([]);
    });

    it("does not return chunks with low similarity to the query", async () => {
      const { workspace, source } = await makeWorkspaceAndSource();
      await sources.updateSyncStatus(source.id, workspace.id, "Ready", new Date());
      const embeddings = new FakeEmbeddingPort(
        new Map([
          ["Our business hours are 9am to 5pm.", fillVector(1)],
          ["Do you ship internationally?", alternatingVector()]
        ])
      );
      const chunks = new PrismaDocumentChunkRepository(embeddings);
      await chunks.insertMany(workspace.id, source.id, [
        { content: "Our business hours are 9am to 5pm.", embedding: fillVector(1), tokenCount: 8, contentHash: "hash-1" }
      ]);

      const matches = await chunks.findBestMatches(workspace.id, "Do you ship internationally?", 3);

      expect(matches).toEqual([]);
    });

    it("prefers diverse content over near-duplicate chunks when picking the top k (MMR)", async () => {
      const { workspace, source } = await makeWorkspaceAndSource();
      await sources.updateSyncStatus(source.id, workspace.id, "Ready", new Date());

      // Two "duplicate" chunks share fillVector(1)'s direction plus a small, near-identical
      // flavor along an orthogonal axis (alternatingVector) — highly relevant to the query and
      // near-identical to each other. The "distinct" chunk shares the same relevant direction
      // but with an opposite flavor — still relevant, but genuinely different content, and far
      // from the duplicates in vector space. Plain top-k similarity picks both duplicates over
      // the distinct chunk; MMR should pick the distinct one instead of the second duplicate.
      function blend(flavorCoefficient: number): number[] {
        const base = fillVector(1);
        const flavor = alternatingVector();
        return base.map((v, i) => v + flavor[i]! * flavorCoefficient);
      }

      const embeddings = new FakeEmbeddingPort(new Map([["What is your policy?", fillVector(1)]]));
      const chunks = new PrismaDocumentChunkRepository(embeddings);
      await chunks.insertMany(workspace.id, source.id, [
        { content: "Duplicate A: 30 day returns.", embedding: blend(0.3), tokenCount: 5, contentHash: "hash-a" },
        { content: "Duplicate B: 30 day returns, restated.", embedding: blend(0.32), tokenCount: 5, contentHash: "hash-b" },
        { content: "Distinct: shipping takes 3-5 business days.", embedding: blend(-0.9), tokenCount: 5, contentHash: "hash-c" }
      ]);

      const matches = await chunks.findBestMatches(workspace.id, "What is your policy?", 2);

      expect(matches.map((m) => m.content)).toContain("Distinct: shipping takes 3-5 business days.");
    });
  });
});
