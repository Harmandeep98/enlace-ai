import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaMembershipRepository } from "./prisma-membership-repository.js";

describe("PrismaMembershipRepository", () => {
  const repo = new PrismaMembershipRepository();

  afterEach(async () => {
    await prisma.membership.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  it("creates a membership scoped to a workspace, visible under that workspace's RLS session", async () => {
    const user = await prisma.user.create({ data: { name: "Ada", email: `${randomUUID()}@example.com` } });
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });

    const membership = await repo.create({ workspaceId: workspace.id, userId: user.id, role: "Owner" });

    expect(membership.role).toBe("Owner");
    expect(membership.status).toBe("Active");

    await prisma.$executeRawUnsafe(`SET app.workspace_id = '${workspace.id}'`);
    const visible = await prisma.membership.findMany();
    expect(visible.map((m) => m.id)).toEqual([membership.id]);
  });

  it("resolves the Active Owner's email", async () => {
    const user = await prisma.user.create({ data: { name: "Ada", email: `${randomUUID()}@example.com` } });
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    await repo.create({ workspaceId: workspace.id, userId: user.id, role: "Owner" });

    const email = await repo.findActiveOwnerEmail(workspace.id);

    expect(email).toBe(user.email);
  });

  it("returns undefined when the workspace has no Owner membership", async () => {
    const user = await prisma.user.create({ data: { name: "Ada", email: `${randomUUID()}@example.com` } });
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    await repo.create({ workspaceId: workspace.id, userId: user.id, role: "Agent" });

    const email = await repo.findActiveOwnerEmail(workspace.id);

    expect(email).toBeUndefined();
  });

  it("returns undefined for a different workspace (tenant isolation)", async () => {
    const user = await prisma.user.create({ data: { name: "Ada", email: `${randomUUID()}@example.com` } });
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });
    await repo.create({ workspaceId: workspace.id, userId: user.id, role: "Owner" });

    const email = await repo.findActiveOwnerEmail(otherWorkspace.id);

    expect(email).toBeUndefined();
  });

  it("findByUserAndWorkspace returns the membership when one exists, and undefined otherwise", async () => {
    const user = await prisma.user.create({ data: { name: "Ada", email: `${randomUUID()}@example.com` } });
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const created = await repo.create({ workspaceId: workspace.id, userId: user.id, role: "Owner" });

    const found = await repo.findByUserAndWorkspace(workspace.id, user.id);
    expect(found?.id).toBe(created.id);

    const otherUser = await prisma.user.create({ data: { name: "Grace", email: `${randomUUID()}@example.com` } });
    const notFound = await repo.findByUserAndWorkspace(workspace.id, otherUser.id);
    expect(notFound).toBeUndefined();
  });
});
