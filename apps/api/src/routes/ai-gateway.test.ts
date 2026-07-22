import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";
import { createAuthenticatedSession } from "../test-support/auth.js";

describe("ai-gateway routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.providerConfig.deleteMany();
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

  it("configures a Platform+Google provider with no credential", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const res = await app.request("/v1/provider-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, provider: "Google", keyMode: "Platform" })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.config.provider).toBe("Google");
  });

  it("rejects Platform mode for a non-Google provider with 400", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const res = await app.request("/v1/provider-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, provider: "OpenAI", keyMode: "Platform" })
    });

    expect(res.status).toBe(400);
  });

  it("rejects a BringYourOwn config with an invalid credential with 400, and persists nothing", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const res = await app.request("/v1/provider-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, provider: "OpenAI", keyMode: "BringYourOwn", credential: "sk-invalid" })
    });

    expect(res.status).toBe(400);
    const configs = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.providerConfig.findMany({ where: { workspaceId: workspace.id } });
    });
    expect(configs).toHaveLength(0);
  });

  it("lists a workspace's configs", async () => {
    const { workspace, cookie } = await makeWorkspace();
    await app.request("/v1/provider-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, provider: "Google", keyMode: "Platform" })
    });

    const res = await app.request(`/v1/provider-configs?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.configs).toHaveLength(1);
  });

  it("disables a config", async () => {
    const { workspace, cookie } = await makeWorkspace();
    const createRes = await app.request("/v1/provider-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, provider: "Google", keyMode: "Platform" })
    });
    const { config } = await createRes.json();

    const res = await app.request(`/v1/provider-configs/${config.id}/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id })
    });

    expect(res.status).toBe(200);
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.providerConfig.findUniqueOrThrow({ where: { id: config.id } });
    });
    expect(row.status).toBe("Disabled");
  });
});
