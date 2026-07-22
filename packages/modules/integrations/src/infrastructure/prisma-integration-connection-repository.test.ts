import { randomBytes, randomUUID } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaIntegrationConnectionRepository } from "./prisma-integration-connection-repository.js";

describe("PrismaIntegrationConnectionRepository", () => {
  const repo = new PrismaIntegrationConnectionRepository();

  beforeAll(() => {
    process.env.KEY_ENCRYPTION_SECRET = randomBytes(32).toString("base64");
  });

  afterEach(async () => {
    await prisma.integrationConnection.deleteMany();
    await prisma.workspace.deleteMany();
  });

  async function makeWorkspace() {
    return prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
  }

  it("creates a connection and finds it by workspace and type", async () => {
    const workspace = await makeWorkspace();

    const created = await repo.create({
      workspaceId: workspace.id,
      type: "Webhook",
      config: { url: "https://example.com/hook" },
      credential: "hmac-secret-123"
    });

    expect(created.type).toBe("Webhook");
    expect(created.status).toBe("Active");
    expect(created.config).toEqual({ url: "https://example.com/hook" });

    const found = await repo.findByWorkspaceAndType(workspace.id, "Webhook");
    expect(found?.id).toBe(created.id);
  });

  it("round-trips the encrypted credential", async () => {
    const workspace = await makeWorkspace();
    const created = await repo.create({
      workspaceId: workspace.id,
      type: "Webhook",
      config: { url: "https://example.com/hook" },
      credential: "hmac-secret-123"
    });

    const credential = await repo.getDecryptedCredential(created.id, workspace.id);

    expect(credential).toBe("hmac-secret-123");
  });

  it("returns undefined for a different workspace (tenant isolation)", async () => {
    const workspace = await makeWorkspace();
    const otherWorkspace = await makeWorkspace();
    await repo.create({
      workspaceId: workspace.id,
      type: "Webhook",
      config: { url: "https://example.com/hook" },
      credential: "hmac-secret-123"
    });

    const found = await repo.findByWorkspaceAndType(otherWorkspace.id, "Webhook");

    expect(found).toBeUndefined();
  });
});
