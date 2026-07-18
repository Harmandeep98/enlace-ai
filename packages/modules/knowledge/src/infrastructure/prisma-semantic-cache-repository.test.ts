import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import type { EmbeddingPort } from "../application/ports.js";
import { PrismaSemanticCacheRepository } from "./prisma-semantic-cache-repository.js";

function fillVector(value: number): number[] {
  return new Array(768).fill(value);
}

// Deterministic and orthogonal to fillVector(1) — dot product is 0 for a 768-length (even)
// array, so cosine similarity between them is 0, letting the "unrelated question" test assert
// a real miss without a live embedding call.
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

describe("PrismaSemanticCacheRepository", () => {
  async function makeWorkspace() {
    return prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
  }

  afterEach(async () => {
    await prisma.semanticCacheEntry.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("saves an answered question and finds it again for a near-identical question", async () => {
    const workspace = await makeWorkspace();
    const embeddings = new FakeEmbeddingPort(
      new Map([
        ["What are your business hours?", fillVector(1)],
        ["what r ur biz hours", fillVector(1)]
      ])
    );
    const repo = new PrismaSemanticCacheRepository(embeddings);

    await repo.save(workspace.id, "What are your business hours?", "9am-5pm Mon-Fri.");
    const match = await repo.findBestMatch(workspace.id, "what r ur biz hours");

    expect(match?.answer).toBe("9am-5pm Mon-Fri.");
  });

  it("returns undefined for a question with no similar cached entry", async () => {
    const workspace = await makeWorkspace();
    const embeddings = new FakeEmbeddingPort(
      new Map([
        ["What are your business hours?", fillVector(1)],
        ["Do you ship internationally?", alternatingVector()]
      ])
    );
    const repo = new PrismaSemanticCacheRepository(embeddings);

    await repo.save(workspace.id, "What are your business hours?", "9am-5pm Mon-Fri.");
    const match = await repo.findBestMatch(workspace.id, "Do you ship internationally?");

    expect(match).toBeUndefined();
  });

  // docs/21-testing-strategy.md §5 — id-only query, so only RLS (not an app-level filter) can hide the row.
  it("RLS blocks reading another workspace's cache entry even with an id-only query", async () => {
    const workspaceA = await makeWorkspace();
    const embeddings = new FakeEmbeddingPort(new Map([["Q", fillVector(1)]]));
    const repo = new PrismaSemanticCacheRepository(embeddings);
    await repo.save(workspaceA.id, "Q", "A");
    const [entryA] = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceA.id}, true)`;
      return tx.$queryRaw<{ id: string }[]>`SELECT id FROM semantic_cache_entries WHERE "workspaceId" = ${workspaceA.id}`;
    });
    if (!entryA) throw new Error("expected a saved entry");
    const workspaceB = await makeWorkspace();

    const rowsVisibleFromB = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceB.id}, true)`;
      return tx.$queryRaw<{ id: string }[]>`SELECT id FROM semantic_cache_entries WHERE id = ${entryA.id}`;
    });

    expect(rowsVisibleFromB).toHaveLength(0);
  });
});
