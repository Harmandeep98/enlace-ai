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

  it("lists a conversation's messages in chronological order, bounded by limit", async () => {
    const workspace = await makeWorkspace();
    const channel = await makeChannel(workspace.id);
    const { conversation } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-1",
      message: "First message"
    });
    await repo.appendMessage({
      conversationId: conversation.id,
      workspaceId: workspace.id,
      sender: "AI",
      content: "Second message",
      resolutionPath: "FaqCache"
    });
    await repo.appendMessage({
      conversationId: conversation.id,
      workspaceId: workspace.id,
      sender: "Customer",
      content: "Third message",
      resolutionPath: null
    });

    const messages = await repo.listMessages(conversation.id, workspace.id, 2);

    expect(messages.map((m) => m.content)).toEqual(["Second message", "Third message"]);
  });

  it("lists conversations for a workspace ordered by most recently updated", async () => {
    const workspace = await makeWorkspace();
    const channel = await makeChannel(workspace.id);
    const { conversation: first } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-1",
      message: "First"
    });
    const { conversation: second } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-2",
      message: "Second"
    });
    await repo.updateStatus(second.id, workspace.id, "Escalated", "LowConfidence");

    const all = await repo.listConversations(workspace.id);

    expect(all.map((c) => c.id)).toEqual([second.id, first.id]);
  });

  it("filters listConversations by status", async () => {
    const workspace = await makeWorkspace();
    const channel = await makeChannel(workspace.id);
    const { conversation: open } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-1",
      message: "Hi"
    });
    const { conversation: escalated } = await repo.create({
      workspaceId: workspace.id,
      channelId: channel.id,
      customerRef: "customer-2",
      message: "Hi"
    });
    await repo.updateStatus(escalated.id, workspace.id, "Escalated", "LowConfidence");

    const escalatedOnly = await repo.listConversations(workspace.id, "Escalated");

    expect(escalatedOnly.map((c) => c.id)).toEqual([escalated.id]);
    expect(escalatedOnly.map((c) => c.id)).not.toContain(open.id);
  });

  it("does not list a conversation created under a different workspace", async () => {
    const workspaceA = await makeWorkspace();
    const channelA = await makeChannel(workspaceA.id);
    await repo.create({ workspaceId: workspaceA.id, channelId: channelA.id, customerRef: "customer-1", message: "Hi" });
    const workspaceB = await makeWorkspace();

    const result = await repo.listConversations(workspaceB.id);

    expect(result).toEqual([]);
  });

  // docs/21-testing-strategy.md §5 — id-only-equivalent isolation via RLS.
  it("returns no messages for a conversation read under a different workspace", async () => {
    const workspaceA = await makeWorkspace();
    const channelA = await makeChannel(workspaceA.id);
    const { conversation } = await repo.create({
      workspaceId: workspaceA.id,
      channelId: channelA.id,
      customerRef: "customer-1",
      message: "Hi"
    });
    const workspaceB = await makeWorkspace();

    const messages = await repo.listMessages(conversation.id, workspaceB.id, 10);

    expect(messages).toEqual([]);
  });
});
