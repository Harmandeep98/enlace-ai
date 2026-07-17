import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { identityRoutes } from "./routes/identity.js";
import { conversationRoutes } from "./routes/conversations.js";
import type { AppEnv } from "./types.js";

export function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("requestId", randomUUID());
    await next();
  });
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/", identityRoutes);
  app.route("/", conversationRoutes);
  return app;
}
