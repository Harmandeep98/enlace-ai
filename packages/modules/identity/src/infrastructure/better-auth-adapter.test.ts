import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { BetterAuthAdapter } from "./better-auth-adapter.js";

describe("BetterAuthAdapter", () => {
  const adapter = new BetterAuthAdapter();

  afterEach(async () => {
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  });

  it("creates a user via Better Auth and returns its id", async () => {
    const email = `${randomUUID()}@example.com`;

    const result = await adapter.signUp({ email, password: "correct horse battery staple", name: "Ada Lovelace" });

    expect(result.userId).toBeTruthy();
    const stored = await prisma.user.findUnique({ where: { id: result.userId } });
    expect(stored?.email).toBe(email);
  });
});
