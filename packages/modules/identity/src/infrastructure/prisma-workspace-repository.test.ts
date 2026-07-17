import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { WorkspaceSlugTakenError } from "../domain/errors.js";
import { PrismaWorkspaceRepository } from "./prisma-workspace-repository.js";

describe("PrismaWorkspaceRepository", () => {
  const repo = new PrismaWorkspaceRepository();

  afterEach(async () => {
    await prisma.workspace.deleteMany();
  });

  it("creates a workspace and returns it with a generated id", async () => {
    const slug = `test-${randomUUID()}`;
    const workspace = await repo.create({ name: "Test Co", slug, planTier: "Free" });

    expect(workspace.id).toBeTruthy();
    expect(workspace.slug).toBe(slug);
    expect(workspace.status).toBe("Active");
  });

  it("throws WorkspaceSlugTakenError on a duplicate slug", async () => {
    const slug = `test-${randomUUID()}`;
    await repo.create({ name: "Test Co", slug, planTier: "Free" });

    await expect(repo.create({ name: "Test Co 2", slug, planTier: "Free" })).rejects.toThrow(
      WorkspaceSlugTakenError
    );
  });

  it("findBySlug returns undefined for a slug that doesn't exist", async () => {
    expect(await repo.findBySlug(`missing-${randomUUID()}`)).toBeUndefined();
  });
});
