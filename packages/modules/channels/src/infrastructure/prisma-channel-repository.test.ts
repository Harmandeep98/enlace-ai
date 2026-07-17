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

  it("creates a default widget channel scoped to the given workspace", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });

    const channel = await repo.createDefaultWidget(workspace.id);

    expect(channel.type).toBe("Widget");
    expect(channel.workspaceId).toBe(workspace.id);

    await prisma.$executeRawUnsafe(`SET app.workspace_id = '${workspace.id}'`);
    const stored = await prisma.channelConnection.findUnique({ where: { id: channel.id } });
    expect(stored?.id).toBe(channel.id);
  });
});
