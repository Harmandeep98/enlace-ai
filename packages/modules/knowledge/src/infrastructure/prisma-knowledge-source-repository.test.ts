import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaKnowledgeSourceRepository } from "./prisma-knowledge-source-repository.js";

describe("PrismaKnowledgeSourceRepository", () => {
  const repo = new PrismaKnowledgeSourceRepository();

  async function makeWorkspace() {
    return prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
  }

  afterEach(async () => {
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("creates a knowledge source starting as Pending and lists it back for its workspace", async () => {
    const workspace = await makeWorkspace();

    const created = await repo.create({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" });
    const listed = await repo.listByWorkspace(workspace.id);

    expect(created.syncStatus).toBe("Pending");
    expect(created.lastSyncedAt).toBeNull();
    expect(listed.map((s) => s.id)).toEqual([created.id]);
  });

  it("updates sync status and lastSyncedAt", async () => {
    const workspace = await makeWorkspace();
    const created = await repo.create({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" });

    const syncedAt = new Date();
    await repo.updateSyncStatus(created.id, workspace.id, "Ready", syncedAt);
    const [updated] = await repo.listByWorkspace(workspace.id);

    expect(updated?.syncStatus).toBe("Ready");
    expect(updated?.lastSyncedAt?.getTime()).toBe(syncedAt.getTime());
  });

  // docs/21-testing-strategy.md §5 — id-only query, so only RLS (not an app-level filter) can hide the row.
  it("RLS blocks reading another workspace's source even with an id-only query", async () => {
    const workspaceA = await makeWorkspace();
    const sourceA = await repo.create({ workspaceId: workspaceA.id, type: "Website", origin: "https://example.com" });
    const workspaceB = await makeWorkspace();

    const rowsVisibleFromB = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceB.id}, true)`;
      return tx.knowledgeSource.findMany({ where: { id: sourceA.id } });
    });

    expect(rowsVisibleFromB).toHaveLength(0);
  });
});
