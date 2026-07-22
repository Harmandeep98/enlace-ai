import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";
import { createAuthenticatedSession } from "../test-support/auth.js";

describe("FAQ routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.faqEntry.deleteMany();
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

  it("POST /v1/faqs creates an FAQ entry", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const res = await app.request("/v1/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, question: "What are your business hours?", answer: "9am-5pm Mon-Fri." })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.faq.question).toBe("What are your business hours?");
  });

  it("GET /v1/faqs lists FAQs for a workspace", async () => {
    const { workspace, cookie } = await makeWorkspace();
    await app.request("/v1/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ workspaceId: workspace.id, question: "What are your business hours?", answer: "9am-5pm Mon-Fri." })
    });

    const res = await app.request(`/v1/faqs?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.faqs).toHaveLength(1);
    expect(body.faqs[0].answer).toBe("9am-5pm Mon-Fri.");
  });

  it("enforces the 401 -> 403 -> 200 ladder for a real route", async () => {
    const { workspace, cookie } = await makeWorkspace();

    const noSession = await app.request(`/v1/faqs?workspaceId=${workspace.id}`);
    expect(noSession.status).toBe(401);

    const otherWorkspace = await prisma.workspace.create({ data: { name: "Other Co", slug: `test-${randomUUID()}` } });
    const wrongWorkspace = await app.request(`/v1/faqs?workspaceId=${otherWorkspace.id}`, { headers: { Cookie: cookie } });
    expect(wrongWorkspace.status).toBe(403);

    const correctWorkspace = await app.request(`/v1/faqs?workspaceId=${workspace.id}`, { headers: { Cookie: cookie } });
    expect(correctWorkspace.status).toBe(200);
  });
});
