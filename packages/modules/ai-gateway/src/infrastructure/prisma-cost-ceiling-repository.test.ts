import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaCostCeilingRepository } from "./prisma-cost-ceiling-repository.js";

describe("PrismaCostCeilingRepository", () => {
  const repo = new PrismaCostCeilingRepository();

  async function makeWorkspace() {
    return prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
  }

  afterEach(async () => {
    await prisma.aiUsageCounter.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("starts at zero tokens spent for a workspace with no usage yet", async () => {
    const workspace = await makeWorkspace();
    expect(await repo.getTokensSpentThisPeriod(workspace.id)).toBe(0);
  });

  it("accumulates tokens added across multiple calls within the same period", async () => {
    const workspace = await makeWorkspace();

    await repo.addTokens(workspace.id, 300);
    await repo.addTokens(workspace.id, 200);

    expect(await repo.getTokensSpentThisPeriod(workspace.id)).toBe(500);
  });

  // docs/21-testing-strategy.md §5 — id-only-equivalent isolation: another workspace's usage
  // never leaks into this workspace's count, even though both may share the same periodStart.
  it("keeps usage isolated per workspace", async () => {
    const workspaceA = await makeWorkspace();
    const workspaceB = await makeWorkspace();

    await repo.addTokens(workspaceA.id, 1000);

    expect(await repo.getTokensSpentThisPeriod(workspaceB.id)).toBe(0);
  });
});
