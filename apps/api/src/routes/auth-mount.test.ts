import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { buildApp } from "../server.js";

describe("Better Auth mount", () => {
  const app = buildApp();

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
  });

  it("signs up via the mounted handler and the resulting cookie authenticates a get-session call", async () => {
    const email = `${randomUUID()}@example.com`;

    const signUpRes = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "correct horse battery staple", name: "Ada Lovelace" })
    });
    expect(signUpRes.status).toBe(200);
    const cookie = signUpRes.headers.get("set-cookie");
    expect(cookie).toBeTruthy();

    const sessionRes = await app.request("/api/auth/get-session", {
      headers: { Cookie: cookie! }
    });
    expect(sessionRes.status).toBe(200);
    const sessionBody = await sessionRes.json();
    expect(sessionBody.user.email).toBe(email);
  });
});
