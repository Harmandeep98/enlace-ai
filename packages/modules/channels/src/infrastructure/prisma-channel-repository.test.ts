import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaChannelRepository } from "./prisma-channel-repository.js";

describe("PrismaChannelRepository", () => {
  const repo = new PrismaChannelRepository();

  afterEach(async () => {
    await prisma.channelConnection.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("creates a default widget channel scoped to the given workspace, with a real generated public key", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });

    const channel = await repo.createDefaultWidget(workspace.id);

    expect(channel.type).toBe("Widget");
    expect(channel.workspaceId).toBe(workspace.id);
    expect(channel.publicKey).toMatch(/^wk_live_[0-9a-f]{32}$/);
    expect(channel.allowedDomains).toEqual([]);

    await prisma.$executeRawUnsafe(`SET app.workspace_id = '${workspace.id}'`);
    const stored = await prisma.channelConnection.findUnique({ where: { id: channel.id } });
    expect(stored?.id).toBe(channel.id);
  });

  it("findByWorkspace returns the workspace's channel", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const created = await repo.createDefaultWidget(workspace.id);

    const found = await repo.findByWorkspace(workspace.id);

    expect(found?.id).toBe(created.id);
  });

  it("findByPublicKey resolves the right workspace's channel without prior workspace context", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const created = await repo.createDefaultWidget(workspace.id);

    const found = await repo.findByPublicKey(created.publicKey);

    expect(found?.id).toBe(created.id);
    expect(found?.workspaceId).toBe(workspace.id);
  });

  it("findByPublicKey returns undefined for an unknown key", async () => {
    const found = await repo.findByPublicKey("wk_live_doesnotexist");

    expect(found).toBeUndefined();
  });

  it("updateAllowedDomains replaces the domain list", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    await repo.createDefaultWidget(workspace.id);

    const updated = await repo.updateAllowedDomains(workspace.id, ["example.com", "app.example.com"]);

    expect(updated.allowedDomains).toEqual(["example.com", "app.example.com"]);
    const refetched = await repo.findByWorkspace(workspace.id);
    expect(refetched?.allowedDomains).toEqual(["example.com", "app.example.com"]);
  });
});
