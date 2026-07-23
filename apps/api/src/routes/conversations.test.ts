import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaMembershipRepository } from "@enlace/identity";
import { GeminiEmbeddingAdapter } from "@enlace/ai-gateway";
import { PrismaDocumentChunkRepository, PrismaKnowledgeSourceRepository } from "@enlace/knowledge";
import { buildApp } from "../server.js";
import { createAuthenticatedSession } from "../test-support/auth.js";

describe("Conversations routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.channelConnection.deleteMany();
    await prisma.integrationConnection.deleteMany();
    await prisma.faqEntry.deleteMany();
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
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
    const { cookie, userId } = await createAuthenticatedSession(app, workspace.id);
    return { workspace, channel, cookie, userId };
  }

  async function makeFaq(workspaceId: string, question: string, answer: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return tx.faqEntry.create({ data: { workspaceId, question, answer } });
    });
  }

  it(
    "POST /v1/conversations starts a conversation with the first message",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();

      const res = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi, I need help." })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.conversation.status).toBe("Open");
      expect(body.message.content).toBe("Hi, I need help.");
      // No FAQ/semantic-cache match, no knowledge seeded — retrieval finds nothing, but
      // completion still runs on the empty context and returns a real, non-null answer
      // (docs/superpowers/specs/2026-07-20-pipeline-retrieval-completion-design.md).
      expect(body.aiReply).not.toBeNull();
      expect(body.aiReply.resolutionPath).toBe("Retrieval");
    },
    30000
  );

  it("POST /v1/conversations returns an FAQ-matched aiReply when the first message matches", async () => {
    const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
    await makeFaq(workspace.id, "What are your business hours", "We're open 9am-5pm Mon-Fri.");

    const res = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "What are your business hours" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.aiReply.content).toBe("We're open 9am-5pm Mon-Fri.");
    expect(body.aiReply.sender).toBe("AI");
    expect(body.aiReply.resolutionPath).toBe("FaqCache");
  });

  it(
    "POST /v1/conversations/:id/messages appends a message",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();

      const res = await app.request(`/v1/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, sender: "Human", content: "How can I help?" })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message.content).toBe("How can I help?");
    },
    30000
  );

  it(
    "POST /v1/conversations/:id/messages returns an FAQ-matched aiReply for a matching customer follow-up",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
      await makeFaq(workspace.id, "How do I reset my password", "Use the 'Forgot password' link on the login page.");
      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();

      const res = await app.request(`/v1/conversations/${conversation.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, sender: "Customer", content: "How do I reset my password" })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.aiReply.content).toBe("Use the 'Forgot password' link on the login page.");
      expect(body.aiReply.resolutionPath).toBe("FaqCache");
    },
    30000
  );

  it(
    "POST /v1/conversations/:id/escalate transitions status and rejects a missing reason",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();

      const missingReason = await app.request(`/v1/conversations/${conversation.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id })
      });
      expect(missingReason.status).toBe(400);

      const res = await app.request(`/v1/conversations/${conversation.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, reason: "LowConfidence" })
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.conversation.status).toBe("Escalated");
    },
    30000
  );

  it(
    "GET /v1/conversations/:id returns 403 for a workspace the caller has no membership in",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
      const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });
      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();

      const res = await app.request(`/v1/conversations/${conversation.id}?workspaceId=${otherWorkspace.id}`, {
        headers: { Cookie: cookie }
      });
      // The caller has no membership at all in otherWorkspace, so the membership check now
      // rejects before the conversation lookup ever runs — this doesn't even leak whether a
      // conversation exists there. The genuinely-a-member-but-wrong-workspace 404 case is
      // covered by the next test.
      expect(res.status).toBe(403);
    },
    30000
  );

  it(
    "GET /v1/conversations/:id returns the conversation's message thread",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();

      const res = await app.request(`/v1/conversations/${conversation.id}?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.messages.length).toBeGreaterThanOrEqual(1);
      expect(body.messages[0].content).toBe("Hi.");
    },
    30000
  );

  it(
    "GET /v1/conversations/:id returns 404 when the caller belongs to the queried workspace but the conversation doesn't",
    async () => {
      const { workspace, channel, cookie, userId } = await makeWorkspaceAndChannel();
      const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });
      await new PrismaMembershipRepository().create({ workspaceId: otherWorkspace.id, userId, role: "Owner" });

      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();

      const res = await app.request(`/v1/conversations/${conversation.id}?workspaceId=${otherWorkspace.id}`, {
        headers: { Cookie: cookie }
      });
      expect(res.status).toBe(404);
    },
    30000
  );

  it(
    "GET /v1/conversations lists every conversation in a workspace",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
      const first = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "First" })
      });
      const { conversation: firstConversation } = await first.json();
      const second = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-2", message: "Second" })
      });
      const { conversation: secondConversation } = await second.json();

      const res = await app.request(`/v1/conversations?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.conversations.map((c: { id: string }) => c.id)).toEqual(
        expect.arrayContaining([firstConversation.id, secondConversation.id])
      );
      expect(body.conversations).toHaveLength(2);
    },
    30000
  );

  it(
    "GET /v1/conversations filters by status",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();
      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();
      await app.request(`/v1/conversations/${conversation.id}/escalate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, reason: "CustomerRequest" })
      });

      const res = await app.request(`/v1/conversations?workspaceId=${workspace.id}&status=Escalated`, { headers: { Cookie: cookie } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.conversations.map((c: { id: string }) => c.id)).toEqual([conversation.id]);
    },
    30000
  );

  it("GET /v1/conversations returns 403 for a workspace the caller has no membership in", async () => {
    const { cookie } = await makeWorkspaceAndChannel();
    const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });

    const res = await app.request(`/v1/conversations?workspaceId=${otherWorkspace.id}`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(403);
  });

  it("GET /v1/conversations/events returns 403 for a workspace the caller has no membership in", async () => {
    const { cookie } = await makeWorkspaceAndChannel();
    const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });

    const res = await app.request(`/v1/conversations/events?workspaceId=${otherWorkspace.id}`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(403);
  });

  it(
    "GET /v1/conversations/events streams a real emitted event to a subscribed client",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();

      const streamRes = await app.request(`/v1/conversations/events?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });
      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get("content-type")).toContain("text/event-stream");

      const reader = streamRes.body!.getReader();
      const decoder = new TextDecoder();

      const startRes = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
      });
      const { conversation } = await startRes.json();

      let received = "";
      while (!received.includes(conversation.id)) {
        const { value, done } = await reader.read();
        if (done) break;
        received += decoder.decode(value);
      }

      expect(received).toContain('"type":"message"');
      expect(received).toContain(conversation.id);

      await reader.cancel();
    },
    30000
  );

  // Hits the real Gemini API (free tier) — skipped without a key, same gating this repo
  // already applies to every other real-API test this session.
  const maybeIt = process.env.GEMINI_API_KEY ? it : it.skip;

  maybeIt(
    "returns a real retrieval-grounded AI reply when no cache matches",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();

      const sourceRepo = new PrismaKnowledgeSourceRepository();
      const embeddingAdapter = new GeminiEmbeddingAdapter();
      const chunkRepo = new PrismaDocumentChunkRepository(embeddingAdapter);

      const source = await sourceRepo.create({ workspaceId: workspace.id, type: "Faq", origin: "manual" });
      await sourceRepo.updateSyncStatus(source.id, workspace.id, "Ready", new Date());

      const content = "Our return policy allows returns within 30 days of purchase with a valid receipt.";
      const embedding = await embeddingAdapter.embed(content);
      await chunkRepo.insertMany(workspace.id, source.id, [{ content, embedding, tokenCount: 20, contentHash: "hash-1" }]);

      const res = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          workspaceId: workspace.id,
          channelId: channel.id,
          customerRef: "customer-1",
          message: "What is your return policy?"
        })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.aiReply).not.toBeNull();
      expect(body.aiReply.resolutionPath).toBe("Retrieval");
      expect(body.aiReply.content.length).toBeGreaterThan(0);
    },
    30000
  );

  maybeIt(
    "calls a workspace's configured webhook tool and answers using its result",
    async () => {
      const { workspace, channel, cookie } = await makeWorkspaceAndChannel();

      let toolCallCount = 0;
      const server = createServer((req, res) => {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          const parsed = JSON.parse(body);
          if (parsed.ping) {
            res.writeHead(200);
            res.end("ok");
            return;
          }
          toolCallCount++;
          res.writeHead(200, { "Content-Type": "text/plain" });
          res.end("Order 12345 shipped yesterday and will arrive tomorrow.");
        });
      });
      await new Promise<void>((resolve) => server.listen(0, resolve));
      const address = server.address();
      const webhookUrl = address && typeof address === "object" ? `http://127.0.0.1:${address.port}` : "";

      const connectionRes = await app.request("/v1/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          workspaceId: workspace.id,
          type: "Webhook",
          config: {
            url: webhookUrl,
            toolName: "get_order_status",
            toolDescription: "Look up the shipping status of a customer's order by its order ID.",
            toolParameters: { type: "object", properties: { orderId: { type: "string" } }, required: ["orderId"] }
          },
          credential: "test-hmac-secret"
        })
      });
      expect(connectionRes.status).toBe(201);

      const res = await app.request("/v1/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: cookie },
        body: JSON.stringify({
          workspaceId: workspace.id,
          channelId: channel.id,
          customerRef: "customer-1",
          message: "What's the status of order 12345?"
        })
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(toolCallCount).toBeGreaterThan(0);
      expect(body.aiReply).not.toBeNull();
      expect(body.aiReply.content.length).toBeGreaterThan(0);

      server.close();
    },
    30000
  );

  it("fans an escalation out to a workspace's configured Slack channel", async () => {
    const { workspace, channel, cookie } = await makeWorkspaceAndChannel();

    const receivedBodies: string[] = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        receivedBodies.push(body);
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    const slackWebhookUrl = address && typeof address === "object" ? `http://127.0.0.1:${address.port}` : "";

    const connectionRes = await app.request("/v1/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, type: "Slack", config: { webhookUrl: slackWebhookUrl } })
    });
    expect(connectionRes.status).toBe(201);

    const startRes = await app.request("/v1/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, channelId: channel.id, customerRef: "customer-1", message: "Hi." })
    });
    const { conversation } = await startRes.json();

    const escalateRes = await app.request(`/v1/conversations/${conversation.id}/escalate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, reason: "CustomerRequest" })
    });
    expect(escalateRes.status).toBe(200);

    // receivedBodies always includes validateConfig's connection-test ping (fired when the
    // Slack connection was created) first. It may also include an earlier real-Gemini
    // confidence-driven auto-escalation notification if the "Hi." message's completion happened
    // to score below the confidence threshold — genuine real-API non-determinism, not a bug in
    // this test. Assert on the specific escalation notification this test triggered (tagged with
    // its own reason) rather than the exact call count or position.
    const escalationBody = receivedBodies.map((body) => JSON.parse(body)).find((parsed) => parsed.text?.includes("CustomerRequest"));
    expect(escalationBody).toBeDefined();
    expect(escalationBody.text).toContain(conversation.id);

    server.close();
  });
});
