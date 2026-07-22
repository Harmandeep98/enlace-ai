// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result.
import { Hono } from "hono";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const INTEGRATION_TYPES = ["Webhook", "Slack", "Zendesk"] as const;

const createIntegrationConnectionSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(INTEGRATION_TYPES),
  config: z.record(z.unknown()),
  credential: z.string().min(1).optional()
});

export const integrationRoutes = new Hono<AppEnv>();

integrationRoutes.post("/v1/integrations", async (c) => {
  const parsed = createIntegrationConnectionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), parsed.data.workspaceId);
    const connection = await container.createIntegrationConnectionUseCase.execute(parsed.data);
    return c.json({ connection }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});
