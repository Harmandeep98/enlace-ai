import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";
import { createAuthenticatedSession } from "../test-support/auth.js";

describe("POST /v1/signup", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.membership.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  it("creates a workspace and returns it with 201", async () => {
    const email = `${randomUUID()}@example.com`;

    const res = await app.request("/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "correct horse battery staple",
        name: "Ada Lovelace",
        workspaceName: "Acme Support Co"
      })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.workspace.slug).toBe("acme-support-co");
  });

  it("returns 409 with error code workspace_slug_taken on a duplicate workspace name", async () => {
    const firstEmail = `${randomUUID()}@example.com`;
    await app.request("/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: firstEmail, password: "correct horse battery staple", name: "Ada", workspaceName: "Dup Co" })
    });

    const res = await app.request("/v1/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `${randomUUID()}@example.com`,
        password: "correct horse battery staple",
        name: "Grace",
        workspaceName: "Dup Co"
      })
    });

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("workspace_slug_taken");
  });

  it("GET /v1/me returns the caller's workspaceId", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const { cookie } = await createAuthenticatedSession(app, workspace.id);

    const res = await app.request("/v1/me", { headers: { Cookie: cookie } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workspaceId).toBe(workspace.id);
  });
});
