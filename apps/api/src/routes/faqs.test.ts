import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";

describe("FAQ routes", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.faqEntry.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("POST /v1/faqs creates an FAQ entry", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });

    const res = await app.request("/v1/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, question: "What are your business hours?", answer: "9am-5pm Mon-Fri." })
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.faq.question).toBe("What are your business hours?");
  });

  it("GET /v1/faqs lists FAQs for a workspace", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    await app.request("/v1/faqs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId: workspace.id, question: "What are your business hours?", answer: "9am-5pm Mon-Fri." })
    });

    const res = await app.request(`/v1/faqs?workspaceId=${workspace.id}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.faqs).toHaveLength(1);
    expect(body.faqs[0].answer).toBe("9am-5pm Mon-Fri.");
  });
});
