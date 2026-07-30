import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";

describe("Widget routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.channelConnection.deleteMany();
    await prisma.workspace.deleteMany();
  });

  async function makeWorkspaceWithChannel(allowedDomains: string[] = ["example.com"]) {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const channel = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.channelConnection.create({ data: { workspaceId: workspace.id, type: "Widget", allowedDomains } });
    });
    return { workspace, channel };
  }

  it("POST /v1/widget/conversations starts a conversation for a valid key and allowed origin", async () => {
    const { channel } = await makeWorkspaceWithChannel();

    const res = await app.request("/v1/widget/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.com" },
      body: JSON.stringify({ publicKey: channel.publicKey, message: "Hi there" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.conversationId).toBeTruthy();
    expect(body.customerRef).toBeTruthy();
  });

  it("POST /v1/widget/conversations mints a customerRef when none is supplied, and reuses one when given", async () => {
    const { channel } = await makeWorkspaceWithChannel();

    const res = await app.request("/v1/widget/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.com" },
      body: JSON.stringify({ publicKey: channel.publicKey, customerRef: "visitor-123", message: "Hi there" })
    });

    const body = await res.json();
    expect(body.customerRef).toBe("visitor-123");
  });

  it("POST /v1/widget/conversations returns 403 for a disallowed origin", async () => {
    const { channel } = await makeWorkspaceWithChannel(["example.com"]);

    const res = await app.request("/v1/widget/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ publicKey: channel.publicKey, message: "Hi there" })
    });

    expect(res.status).toBe(403);
  });

  it("POST /v1/widget/conversations returns 403 for an unknown public key", async () => {
    await makeWorkspaceWithChannel();

    const res = await app.request("/v1/widget/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.com" },
      body: JSON.stringify({ publicKey: "wk_live_doesnotexist", message: "Hi there" })
    });

    expect(res.status).toBe(403);
  });

  it("POST /v1/widget/conversations/:id/messages adds a follow-up message", async () => {
    const { channel } = await makeWorkspaceWithChannel();
    const startRes = await app.request("/v1/widget/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.com" },
      body: JSON.stringify({ publicKey: channel.publicKey, message: "Hi there" })
    });
    const { conversationId } = await startRes.json();

    const res = await app.request(`/v1/widget/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.com" },
      body: JSON.stringify({ publicKey: channel.publicKey, content: "A follow-up question" })
    });

    expect(res.status).toBe(201);
  });

  it("POST /v1/widget/conversations/:id/messages returns 404 for a conversation belonging to a different workspace", async () => {
    const { channel } = await makeWorkspaceWithChannel();
    const { channel: otherChannel } = await makeWorkspaceWithChannel(["other.example"]);
    const startRes = await app.request("/v1/widget/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://example.com" },
      body: JSON.stringify({ publicKey: channel.publicKey, message: "Hi there" })
    });
    const { conversationId } = await startRes.json();

    const res = await app.request(`/v1/widget/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://other.example" },
      body: JSON.stringify({ publicKey: otherChannel.publicKey, content: "Trying to reach someone else's conversation" })
    });

    expect(res.status).toBe(404);
  });

  it(
    "GET /v1/widget/conversations/:id/events streams reply-done for a cache-hit reply",
    async () => {
      const { workspace, channel } = await makeWorkspaceWithChannel();
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
        await tx.faqEntry.create({ data: { workspaceId: workspace.id, question: "What are your hours?", answer: "9am to 5pm." } });
      });

      const startRes = await app.request("/v1/widget/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://example.com" },
        body: JSON.stringify({ publicKey: channel.publicKey, message: "What are your hours?" })
      });
      const { conversationId } = await startRes.json();

      const streamRes = await app.request(
        `/v1/widget/conversations/${conversationId}/events?publicKey=${channel.publicKey}`,
        { headers: { Origin: "https://example.com" } }
      );
      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get("content-type")).toContain("text/event-stream");

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();
      let received = "";
      while (!received.includes('"type":"reply-done"')) {
        const { value, done } = await reader.read();
        if (done) break;
        received += decoder.decode(value);
      }

      expect(received).toContain('"type":"reply-done"');
      await reader.cancel();
    },
    30000
  );
});
