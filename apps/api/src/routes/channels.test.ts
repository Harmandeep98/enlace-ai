import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";
import { createAuthenticatedSession } from "../test-support/auth.js";

describe("Channel routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.channelConnection.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await prisma.workspace.deleteMany();
  });

  async function makeWorkspaceWithChannel() {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const channel = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.channelConnection.create({ data: { workspaceId: workspace.id, type: "Widget" } });
    });
    const { cookie } = await createAuthenticatedSession(app, workspace.id);
    return { workspace, channel, cookie };
  }

  it("GET /v1/channels returns the workspace's channel with its public key", async () => {
    const { workspace, channel, cookie } = await makeWorkspaceWithChannel();

    const res = await app.request(`/v1/channels?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel.id).toBe(channel.id);
    expect(body.channel.publicKey).toMatch(/^wk_live_/);
    expect(body.channel.allowedDomains).toEqual([]);
  });

  it("GET /v1/channels returns 403 for a workspace the caller has no membership in", async () => {
    const { cookie } = await makeWorkspaceWithChannel();
    const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });

    const res = await app.request(`/v1/channels?workspaceId=${otherWorkspace.id}`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(403);
  });

  it("PATCH /v1/channels/allowed-domains updates the domain list", async () => {
    const { workspace, cookie } = await makeWorkspaceWithChannel();

    const res = await app.request("/v1/channels/allowed-domains", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, domains: ["example.com"] })
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channel.allowedDomains).toEqual(["example.com"]);
  });

  it("PATCH /v1/channels/allowed-domains rejects an invalid domain", async () => {
    const { workspace, cookie } = await makeWorkspaceWithChannel();

    const res = await app.request("/v1/channels/allowed-domains", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, domains: ["https://example.com"] })
    });

    expect(res.status).toBe(400);
  });
});
