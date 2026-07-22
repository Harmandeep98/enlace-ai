// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result.
import { Hono } from "hono";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const PROVIDERS = ["Google", "OpenAI", "Anthropic", "OpenRouter", "Ollama"] as const;
const KEY_MODES = ["Platform", "BringYourOwn"] as const;

const configureProviderSchema = z.object({
  workspaceId: z.string().min(1),
  provider: z.enum(PROVIDERS),
  keyMode: z.enum(KEY_MODES),
  credential: z.string().min(1).optional()
});

const rotateSchema = z.object({
  workspaceId: z.string().min(1),
  credential: z.string().min(1)
});

const disableSchema = z.object({
  workspaceId: z.string().min(1)
});

export const aiGatewayRoutes = new Hono<AppEnv>();

aiGatewayRoutes.post("/v1/provider-configs", async (c) => {
  const parsed = configureProviderSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), parsed.data.workspaceId);
    const config = await container.configureProviderUseCase.execute(parsed.data);
    return c.json({ config }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

aiGatewayRoutes.get("/v1/provider-configs", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) {
    return c.json({ error: { code: "validation_error", message: "workspaceId query param is required.", requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), workspaceId);
    const configs = await container.listProviderConfigsUseCase.execute(workspaceId);
    return c.json({ configs }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

aiGatewayRoutes.post("/v1/provider-configs/:id/rotate", async (c) => {
  const parsed = rotateSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), parsed.data.workspaceId);
    const config = await container.rotateProviderKeyUseCase.execute({
      configId: c.req.param("id"),
      workspaceId: parsed.data.workspaceId,
      credential: parsed.data.credential
    });
    return c.json({ config }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

aiGatewayRoutes.post("/v1/provider-configs/:id/disable", async (c) => {
  const parsed = disableSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), parsed.data.workspaceId);
    await container.disableProviderConfigUseCase.execute(c.req.param("id"), parsed.data.workspaceId);
    return c.json({ ok: true }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});
