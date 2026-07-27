// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing else.
import { Hono } from "hono";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const updateAllowedDomainsSchema = z.object({
  workspaceId: z.string().min(1),
  domains: z.array(z.string())
});

export const channelRoutes = new Hono<AppEnv>();

channelRoutes.get("/v1/channels", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) {
    return c.json({ error: { code: "validation_error", message: "workspaceId query param is required.", requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), workspaceId);
    const channel = await container.getChannelUseCase.execute({ workspaceId });
    return c.json({ channel }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

channelRoutes.patch("/v1/channels/allowed-domains", async (c) => {
  const parsed = updateAllowedDomainsSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), parsed.data.workspaceId);
    const channel = await container.updateAllowedDomainsUseCase.execute(parsed.data);
    return c.json({ channel }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});
