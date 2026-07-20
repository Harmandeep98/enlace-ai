import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaProviderConfigRepository } from "./prisma-provider-config-repository.js";

describe("PrismaProviderConfigRepository", () => {
  const repo = new PrismaProviderConfigRepository();

  async function makeWorkspace() {
    return prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
  }

  afterEach(async () => {
    await prisma.providerConfig.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it("upserts a Platform config with no credential and lists it back", async () => {
    const workspace = await makeWorkspace();

    const created = await repo.upsert({ workspaceId: workspace.id, provider: "Google", keyMode: "Platform", credential: null });
    const listed = await repo.listByWorkspace(workspace.id);

    expect(created.status).toBe("Active");
    expect(listed.map((c) => c.id)).toEqual([created.id]);
  });

  it("upserts a BringYourOwn config, encrypting the credential at rest", async () => {
    const workspace = await makeWorkspace();

    const created = await repo.upsert({
      workspaceId: workspace.id,
      provider: "OpenAI",
      keyMode: "BringYourOwn",
      credential: "sk-real-looking-secret"
    });

    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.providerConfig.findUniqueOrThrow({ where: { id: created.id } });
    });
    expect(row.encryptedApiKey).not.toBe("sk-real-looking-secret");
    expect(row.encryptedApiKey).toContain(":");
  });

  it("reconfiguring the same provider updates the existing row instead of creating a second one", async () => {
    const workspace = await makeWorkspace();
    await repo.upsert({ workspaceId: workspace.id, provider: "OpenAI", keyMode: "BringYourOwn", credential: "sk-first" });

    await repo.upsert({ workspaceId: workspace.id, provider: "OpenAI", keyMode: "BringYourOwn", credential: "sk-second" });
    const listed = await repo.listByWorkspace(workspace.id);

    expect(listed).toHaveLength(1);
  });

  it("rotates a credential", async () => {
    const workspace = await makeWorkspace();
    const created = await repo.upsert({
      workspaceId: workspace.id,
      provider: "Anthropic",
      keyMode: "BringYourOwn",
      credential: "sk-ant-original"
    });

    await repo.rotateCredential(created.id, workspace.id, "sk-ant-rotated");
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
      return tx.providerConfig.findUniqueOrThrow({ where: { id: created.id } });
    });

    expect(row.encryptedApiKey).not.toContain("sk-ant-rotated");
    expect(row.encryptedApiKey).not.toBe(null);
  });

  it("updates status to Disabled", async () => {
    const workspace = await makeWorkspace();
    const created = await repo.upsert({ workspaceId: workspace.id, provider: "Google", keyMode: "Platform", credential: null });

    await repo.updateStatus(created.id, workspace.id, "Disabled");
    const [updated] = await repo.listByWorkspace(workspace.id);

    expect(updated?.status).toBe("Disabled");
  });

  // docs/21-testing-strategy.md §5 — id-only query, so only RLS (not an app-level filter) can hide the row.
  it("RLS blocks reading another workspace's config even with an id-only query", async () => {
    const workspaceA = await makeWorkspace();
    const created = await repo.upsert({ workspaceId: workspaceA.id, provider: "Google", keyMode: "Platform", credential: null });
    const workspaceB = await makeWorkspace();

    const foundFromB = await repo.findById(created.id, workspaceB.id);

    expect(foundFromB).toBeUndefined();
  });

  describe("getDecryptedCredential", () => {
    it("returns the original plaintext credential for a BringYourOwn config", async () => {
      const workspace = await makeWorkspace();
      const created = await repo.upsert({
        workspaceId: workspace.id,
        provider: "OpenAI",
        keyMode: "BringYourOwn",
        credential: "sk-real-looking-secret"
      });

      const credential = await repo.getDecryptedCredential(created.id, workspace.id);

      expect(credential).toBe("sk-real-looking-secret");
    });

    it("returns null for a Platform config with no stored credential", async () => {
      const workspace = await makeWorkspace();
      const created = await repo.upsert({ workspaceId: workspace.id, provider: "Google", keyMode: "Platform", credential: null });

      const credential = await repo.getDecryptedCredential(created.id, workspace.id);

      expect(credential).toBeNull();
    });
  });
});
