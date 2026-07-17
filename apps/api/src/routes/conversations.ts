// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing else.
import { Hono } from "hono";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const startConversationSchema = z.object({
  workspaceId: z.string().min(1),
  channelId: z.string().min(1),
  customerRef: z.string().min(1),
  message: z.string().min(1)
});

const addMessageSchema = z.object({
  workspaceId: z.string().min(1),
  sender: z.enum(["Customer", "AI", "Human"]),
  content: z.string().min(1)
});

const escalateSchema = z.object({
  workspaceId: z.string().min(1),
  reason: z.enum(["LowConfidence", "CustomerRequest", "ToolFailure", "PolicyTrigger"])
});

export const conversationRoutes = new Hono<AppEnv>();

conversationRoutes.post("/v1/conversations", async (c) => {
  const parsed = startConversationSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    const result = await container.startConversationUseCase.execute(parsed.data);
    return c.json(result, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

conversationRoutes.post("/v1/conversations/:id/messages", async (c) => {
  const parsed = addMessageSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    const message = await container.addMessageUseCase.execute({ conversationId: c.req.param("id"), ...parsed.data });
    return c.json({ message }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

conversationRoutes.post("/v1/conversations/:id/escalate", async (c) => {
  const parsed = escalateSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    const conversation = await container.escalateConversationUseCase.execute({ conversationId: c.req.param("id"), ...parsed.data });
    return c.json({ conversation }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

conversationRoutes.get("/v1/conversations/:id", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) {
    return c.json({ error: { code: "validation_error", message: "workspaceId query param is required.", requestId: c.get("requestId") } }, 400);
  }

  try {
    const conversation = await container.getConversationUseCase.execute({ conversationId: c.req.param("id"), workspaceId });
    return c.json({ conversation }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});
