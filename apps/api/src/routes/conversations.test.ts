import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";

describe("Conversations routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.channelConnection.deleteMany();
    await prisma.faqEntry.deleteMany();
    await prisma.workspace.deleteMany();
  });

  async function makeWorkspaceAndChannel() {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    // channel_connections has RLS with no WITH CHECK, so USING applies to this insert too —
    // set the session var in the same transaction (same fix as the repository test).
    const channel = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.channelConnection.create({ data: { workspaceId: workspace.id, type: "Widget" } });
    });
    return { workspace, channel };
  }

  async function makeFaq(workspaceId: string, question: string, answer: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return tx.faqEntry.create({ data: { workspaceId, question, answer } });
    });
  }

  it("POST /v1/conversations starts a conversation with the first message", async () => {
    const { workspace, channel } = await makeWorkspaceAndChannel();

    const res = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi, I need help." })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.conversation.status).toBe("Open");
    expect(body.message.content).toBe("Hi, I need help.");
    expect(body.aiReply).toBeNull();
  });

  it("POST /v1/conversations returns an FAQ-matched aiReply when the first message matches", async () => {
    const { workspace, channel } = await makeWorkspaceAndChannel();
    await makeFaq(workspace.id, "What are your business hours", "We're open 9am-5pm Mon-Fri.");

    const res = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "What are your business hours" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.aiReply.content).toBe("We're open 9am-5pm Mon-Fri.");
    expect(body.aiReply.sender).toBe("AI");
    expect(body.aiReply.resolutionPath).toBe("FaqCache");
  });

  it("POST /v1/conversations/:id/messages appends a message", async () => {
    const { workspace, channel } = await makeWorkspaceAndChannel();
    const startRes = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
    });
    const { conversation } = await startRes.json();

    const res = await app.request(`/v1/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, sender: "Human", content: "How can I help?" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message.content).toBe("How can I help?");
  });

  it("POST /v1/conversations/:id/messages returns an FAQ-matched aiReply for a matching customer follow-up", async () => {
    const { workspace, channel } = await makeWorkspaceAndChannel();
    await makeFaq(workspace.id, "How do I reset my password", "Use the 'Forgot password' link on the login page.");
    const startRes = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
    });
    const { conversation } = await startRes.json();

    const res = await app.request(`/v1/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, sender: "Customer", content: "How do I reset my password" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.aiReply.content).toBe("Use the 'Forgot password' link on the login page.");
    expect(body.aiReply.resolutionPath).toBe("FaqCache");
  });

  it("POST /v1/conversations/:id/escalate transitions status and rejects a missing reason", async () => {
    const { workspace, channel } = await makeWorkspaceAndChannel();
    const startRes = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
    });
    const { conversation } = await startRes.json();

    const missingReason = await app.request(`/v1/conversations/${conversation.id}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id })
    });
    expect(missingReason.status).toBe(400);

    const res = await app.request(`/v1/conversations/${conversation.id}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, reason: "LowConfidence" })
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.conversation.status).toBe("Escalated");
  });

  it("GET /v1/conversations/:id returns 404 for a workspace that doesn't own it", async () => {
    const { workspace, channel } = await makeWorkspaceAndChannel();
    const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });
    const startRes = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
    });
    const { conversation } = await startRes.json();

    const res = await app.request(`/v1/conversations/${conversation.id}?workspaceId=${otherWorkspace.id}`);
    expect(res.status).toBe(404);
  });
});
