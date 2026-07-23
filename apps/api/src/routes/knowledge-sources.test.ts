import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";
import { createAuthenticatedSession } from "../test-support/auth.js";

describe("Knowledge source routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await prisma.workspace.deleteMany();
  });

  async function makeWorkspace() {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const { cookie } = await createAuthenticatedSession(app, workspace.id);
    return { workspace, cookie };
  }

  it("POST /v1/knowledge-sources creates a Website source starting as Pending", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const res = await app.request("/v1/knowledge-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source.type).toBe("Website");
    expect(body.source.syncStatus).toBe("Pending");
  });

  it("GET /v1/knowledge-sources lists sources for a workspace", async () => {
    const { workspace, cookie } = await makeWorkspace();
    await app.request("/v1/knowledge-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" })
    });

    const res = await app.request(`/v1/knowledge-sources?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].origin).toBe("https://example.com");
  });

  it("POST /v1/knowledge-sources for a Website starts the sync workflow (queues without error)", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const res = await app.request("/v1/knowledge-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" })
    });

    // No worker is running during this test, so the workflow just sits queued in Temporal —
    // this asserts the route successfully reaches Temporal (201, not a 500 from a failed
    // workflow.start call), not that a crawl actually completes.
    expect(res.status).toBe(201);
  });

  it("DELETE /v1/knowledge-sources/:id deletes a source", async () => {
    const { workspace, cookie } = await makeWorkspace();
    const createRes = await app.request("/v1/knowledge-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" })
    });
    const { source } = await createRes.json();

    const res = await app.request(`/v1/knowledge-sources/${source.id}?workspaceId=${workspace.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie }
    });

    expect(res.status).toBe(204);
    const listRes = await app.request(`/v1/knowledge-sources?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });
    const listBody = await listRes.json();
    expect(listBody.sources).toHaveLength(0);
  });

  it("DELETE /v1/knowledge-sources/:id returns 404 for a source that doesn't exist in that workspace", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const res = await app.request(`/v1/knowledge-sources/00000000-0000-0000-0000-000000000000?workspaceId=${workspace.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie }
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /v1/knowledge-sources/:id returns 403 for a workspace the caller has no membership in", async () => {
    const { cookie } = await makeWorkspace();
    const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });

    const res = await app.request(`/v1/knowledge-sources/00000000-0000-0000-0000-000000000000?workspaceId=${otherWorkspace.id}`, {
      method: "DELETE",
      headers: { Cookie: cookie }
    });

    expect(res.status).toBe(403);
  });
});
