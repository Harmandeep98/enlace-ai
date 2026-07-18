import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";

describe("Knowledge source routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("POST /v1/knowledge-sources creates a Website source starting as Pending", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });

    const res = await app.request("/v1/knowledge-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.source.type).toBe("Website");
    expect(body.source.syncStatus).toBe("Pending");
  });

  it("GET /v1/knowledge-sources lists sources for a workspace", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    await app.request("/v1/knowledge-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, type: "Website", origin: "https://example.com" })
    });

    const res = await app.request(`/v1/knowledge-sources?workspaceId=${workspace.id}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sources).toHaveLength(1);
    expect(body.sources[0].origin).toBe("https://example.com");
  });
});
