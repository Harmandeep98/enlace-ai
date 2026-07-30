import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "@enlace/identity";
import { identityRoutes } from "./routes/identity.js";
import { conversationRoutes } from "./routes/conversations.js";
import { faqRoutes } from "./routes/faqs.js";
import { knowledgeSourceRoutes } from "./routes/knowledge-sources.js";
import { aiGatewayRoutes } from "./routes/ai-gateway.js";
import { integrationRoutes } from "./routes/integrations.js";
import { channelRoutes } from "./routes/channels.js";
import { widgetRoutes } from "./routes/widget.js";
import type { AppEnv } from "./types.js";

const PUBLIC_PATHS = ["/health", "/v1/signup"];

export function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("*", async (c, next) => {
    c.set("requestId", randomUUID());
    await next();
  });
  app.use(
    "*",
    cors({
      origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
      credentials: true
    })
  );
  app.use("*", async (c, next) => {
    if (PUBLIC_PATHS.includes(c.req.path) || c.req.path.startsWith("/api/auth/") || c.req.path.startsWith("/v1/widget/")) {
      return next();
    }
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json({ error: { code: "unauthorized", message: "Sign in required.", requestId: c.get("requestId") } }, 401);
    }
    c.set("userId", session.user.id);
    await next();
  });
  app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
  app.get("/health", (c) => c.json({ ok: true }));
  app.route("/", identityRoutes);
  app.route("/", conversationRoutes);
  app.route("/", faqRoutes);
  app.route("/", knowledgeSourceRoutes);
  app.route("/", aiGatewayRoutes);
  app.route("/", integrationRoutes);
  app.route("/", channelRoutes);
  app.route("/", widgetRoutes);
  return app;
}
