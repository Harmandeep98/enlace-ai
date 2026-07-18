import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaKnowledgeSourceRepository } from "@enlace/knowledge";
import { startTestSite } from "../test-support/test-site.js";
import { discoverPages, ingestPage } from "./knowledge-sync.js";

describe("discoverPages", () => {
  it("discovers both pages from the test site's sitemap", async () => {
    const site = await startTestSite();
    try {
      const pages = await discoverPages(site.baseUrl);
      expect(pages.sort()).toEqual([`${site.baseUrl}/page-1`, `${site.baseUrl}/page-2`].sort());
    } finally {
      await site.close();
    }
  });
});

describe("ingestPage", () => {
  const sources = new PrismaKnowledgeSourceRepository();

  afterEach(async () => {
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("fetches, chunks, embeds, and stores a real page's content", async () => {
    const site = await startTestSite();
    try {
      const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
      const source = await sources.create({ workspaceId: workspace.id, type: "Website", origin: site.baseUrl });

      const result = await ingestPage(workspace.id, source.id, `${site.baseUrl}/page-1`);

      expect(result.success).toBe(true);
      const rows = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
        return tx.$queryRaw<{ content: string }[]>`SELECT content FROM document_chunks WHERE "sourceId" = ${source.id}`;
      });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows[0]?.content).toContain("business hours");
    } finally {
      await site.close();
    }
  });

  it("returns success: false for a page that doesn't exist", async () => {
    const site = await startTestSite();
    try {
      const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
      const source = await sources.create({ workspaceId: workspace.id, type: "Website", origin: site.baseUrl });

      const result = await ingestPage(workspace.id, source.id, `${site.baseUrl}/does-not-exist`);

      expect(result.success).toBe(false);
    } finally {
      await site.close();
    }
  });
});
