import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaKnowledgeSourceRepository } from "./prisma-knowledge-source-repository.js";
import { PrismaDocumentChunkRepository } from "./prisma-document-chunk-repository.js";

function fillVector(value: number): number[] {
  return new Array(768).fill(value);
}

describe("PrismaDocumentChunkRepository", () => {
  const sources = new PrismaKnowledgeSourceRepository();
  const chunks = new PrismaDocumentChunkRepository();

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
});
