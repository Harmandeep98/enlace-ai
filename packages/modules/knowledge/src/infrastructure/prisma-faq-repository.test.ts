import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaFaqRepository } from "./prisma-faq-repository.js";

describe("PrismaFaqRepository", () => {
  const repo = new PrismaFaqRepository();

  async function makeWorkspace() {
    return prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
  }

  afterEach(async () => {
    await prisma.faqEntry.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("creates an FAQ entry and lists it back for its workspace", async () => {
    const workspace = await makeWorkspace();

    const created = await repo.create({ workspaceId: workspace.id, question: "What are your hours?", answer: "9am-5pm." });
    const listed = await repo.listByWorkspace(workspace.id);

    expect(created.question).toBe("What are your hours?");
    expect(listed.map((entry) => entry.id)).toEqual([created.id]);
  });

  it("findBestMatch returns the matching entry for a workspace", async () => {
    const workspace = await makeWorkspace();
    await repo.create({ workspaceId: workspace.id, question: "What are your business hours", answer: "9am-5pm Mon-Fri." });

    const match = await repo.findBestMatch(workspace.id, "What are your business hours");

    expect(match?.answer).toBe("9am-5pm Mon-Fri.");
  });

  it("findBestMatch returns undefined when nothing qualifies", async () => {
    const workspace = await makeWorkspace();
    await repo.create({ workspaceId: workspace.id, question: "What are your business hours", answer: "9am-5pm Mon-Fri." });

    const match = await repo.findBestMatch(workspace.id, "Do you ship internationally");

    expect(match).toBeUndefined();
  });

  // docs/21-testing-strategy.md §5 — this must exercise RLS itself, not an app-level filter.
  // The query below filters only by "id", never by workspaceId, so only the RLS policy
  // (not the Prisma `where` clause) could possibly hide workspace A's row from workspace B.
  it("RLS blocks reading another workspace's FAQ even with an id-only query", async () => {
    const workspaceA = await makeWorkspace();
    const entryA = await repo.create({ workspaceId: workspaceA.id, question: "What are your hours?", answer: "9am-5pm." });
    const workspaceB = await makeWorkspace();

    const rowsVisibleFromB = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceB.id}, true)`;
      return tx.faqEntry.findMany({ where: { id: entryA.id } });
    });

    expect(rowsVisibleFromB).toHaveLength(0);
  });
});
