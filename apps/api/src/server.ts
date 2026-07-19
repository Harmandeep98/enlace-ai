import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { identityRoutes } from "./routes/identity.js";
import { conversationRoutes } from "./routes/conversations.js";
import { faqRoutes } from "./routes/faqs.js";
import { knowledgeSourceRoutes } from "./routes/knowledge-sources.js";
import { aiGatewayRoutes } from "./routes/ai-gateway.js";
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
  app.route("/", faqRoutes);
  app.route("/", knowledgeSourceRoutes);
  app.route("/", aiGatewayRoutes);
  return app;
}
