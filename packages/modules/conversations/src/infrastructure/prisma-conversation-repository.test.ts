import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaConversationRepository } from "./prisma-conversation-repository.js";

describe("PrismaConversationRepository", () => {
  const repo = new PrismaConversationRepository();

  async function makeWorkspace() {
    return prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
  }

  async function makeChannel(workspaceId: string) {
    // channel_connections has RLS with no WITH CHECK, so USING applies to this insert too —
    // set the session var in the same transaction, same pattern PrismaChannelRepository uses.
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return tx.channelConnection.create({ data: { workspaceId, type: "Widget" } });
    });
  }

  afterEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.channelConnection.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("creates a conversation with its first customer message", async () => {
    const workspace = await makeWorkspace();
    const channel = await makeChannel(workspace.id);

    const { conversation, message } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-1",
      message: "Hi, I need help."
    });

    expect(conversation.status).toBe("Open");
    expect(conversation.escalationReason).toBeNull();
    expect(message.sender).toBe("Customer");
    expect(message.content).toBe("Hi, I need help.");
  });

  it("does not return a conversation when read under a different workspace (RLS)", async () => {
    const workspaceA = await makeWorkspace();
    const channelA = await makeChannel(workspaceA.id);
    const workspaceB = await makeWorkspace();

    const { conversation } = await repo.create({
      workspaceId: workspaceA.id,
      channelId: channelA.id,
      customerRef: "customer-1",
      message: "Hi, I need help."
    });

    const visibleFromB = await repo.findById(conversation.id, workspaceB.id);
    expect(visibleFromB).toBeUndefined();

    const visibleFromA = await repo.findById(conversation.id, workspaceA.id);
    expect(visibleFromA?.id).toBe(conversation.id);
  });

  it("appends a message to an existing conversation", async () => {
    const workspace = await makeWorkspace();
    const channel = await makeChannel(workspace.id);
    const { conversation } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-1",
      message: "Hi, I need help."
    });

    const message = await repo.appendMessage({
      conversationId: conversation.id,
      workspaceId: workspace.id,
      sender: "Human",
      content: "How can I help?",
      resolutionPath: null
    });

    expect(message.sender).toBe("Human");
    expect(message.content).toBe("How can I help?");
  });

  it("updates status and persists the escalation reason", async () => {
    const workspace = await makeWorkspace();
    const channel = await makeChannel(workspace.id);
    const { conversation } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-1",
      message: "Hi, I need help."
    });

    const updated = await repo.updateStatus(conversation.id, workspace.id, "Escalated", "LowConfidence");

    expect(updated.status).toBe("Escalated");
    expect(updated.escalationReason).toBe("LowConfidence");
  });
});
