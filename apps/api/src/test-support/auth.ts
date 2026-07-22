import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import { PrismaMembershipRepository } from "@enlace/identity";
import type { AppEnv } from "../types.js";

const memberships = new PrismaMembershipRepository();

// Establishes a real Better Auth session (via the mounted handler, so the returned cookie is
// genuine — not a hand-rolled fake) and a real Active Membership tying that session's user to
// the given workspace, so route tests can attach `Cookie: cookie` to every request the way a
// real signed-in browser session would.
export async function createAuthenticatedSession(app: Hono<AppEnv>, workspaceId: string): Promise<{ cookie: string; userId: string }> {
  const email = `${randomUUID()}@example.com`;
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Test User" })
  });
  const cookie = res.headers.get("set-cookie");
  if (!cookie) {
    throw new Error("createAuthenticatedSession: sign-up did not return a session cookie.");
  }
  const body = (await res.json()) as { user: { id: string } };
  await memberships.create({ workspaceId, userId: body.user.id, role: "Owner" });
  return { cookie, userId: body.user.id };
}
