// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing else.
import { Hono } from "hono";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  workspaceName: z.string().min(1)
});

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
