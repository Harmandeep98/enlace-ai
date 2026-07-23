// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing else.
import { Hono } from "hono";
import { signUpSchema } from "@enlace/contracts";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

export const identityRoutes = new Hono<AppEnv>();

identityRoutes.post("/v1/signup", async (c) => {
  const parsed = signUpSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    const result = await container.signUpUseCase.execute(parsed.data);
    return c.json({ workspace: result.workspace, userId: result.userId }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

identityRoutes.get("/v1/me", async (c) => {
  const workspaceId = await container.getMyWorkspaceUseCase.execute(c.get("userId"));
  if (!workspaceId) {
    return c.json({ error: { code: "no_workspace", message: "No workspace found for this account.", requestId: c.get("requestId") } }, 404);
  }
  return c.json({ workspaceId }, 200);
});
