// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing
// else. These routes are the one exception to "every route requires a session" (server.ts) —
// they authenticate via widget public key + Origin/Referer instead.
import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import { checkRateLimit } from "../middleware/rate-limit.js";
import type { AppEnv } from "../types.js";

const startSchema = z.object({
  publicKey: z.string().min(1),
  customerRef: z.string().min(1).optional(),
  message: z.string().min(1)
});

const messageSchema = z.object({
  publicKey: z.string().min(1),
  content: z.string().min(1)
});

export const widgetRoutes = new Hono<AppEnv>();

async function runReplyPipeline(conversationId: string, workspaceId: string, content: string): Promise<void> {
  for await (const event of container.incomingWidgetMessageUseCase.streamReply(conversationId, workspaceId, content)) {
    if (event.type === "chunk") {
      container.conversationEventBus.emit(workspaceId, { type: "reply-chunk", conversationId, delta: event.delta });
    } else {
      container.conversationEventBus.emit(workspaceId, { type: "reply-done", conversationId, message: event.message });
    }
  }
}

// Fire-and-forget from both routes below — the response already returned before this runs, so
// a failure here (e.g. the conversation having been deleted in the meantime) has no caller left
// to report it to. Catch and log rather than letting it surface as an unhandled rejection.
function startReplyPipeline(conversationId: string, workspaceId: string, content: string): void {
  runReplyPipeline(conversationId, workspaceId, content).catch((error) => {
    console.error(`Widget reply pipeline failed for conversation ${conversationId}:`, error);
  });
}

widgetRoutes.post("/v1/widget/conversations", async (c) => {
  const parsed = startSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }
  if (!checkRateLimit(parsed.data.publicKey)) {
    return c.json({ error: { code: "rate_limited", message: "Too many requests.", requestId: c.get("requestId") } }, 429);
  }

  try {
    const { workspaceId, channelId } = await container.verifyWidgetOriginUseCase.execute({
      publicKey: parsed.data.publicKey,
      originHeader: c.req.header("Origin"),
      refererHeader: c.req.header("Referer")
    });
    const customerRef = parsed.data.customerRef ?? randomUUID();
    const result = await container.startConversationUseCase.execute({
      workspaceId,
      channelId,
      customerRef,
      message: parsed.data.message
    });
    startReplyPipeline(result.conversation.id, workspaceId, parsed.data.message);
    return c.json({ conversationId: result.conversation.id, customerRef }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

widgetRoutes.post("/v1/widget/conversations/:id/messages", async (c) => {
  const parsed = messageSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }
  if (!checkRateLimit(parsed.data.publicKey)) {
    return c.json({ error: { code: "rate_limited", message: "Too many requests.", requestId: c.get("requestId") } }, 429);
  }

  try {
    const { workspaceId } = await container.verifyWidgetOriginUseCase.execute({
      publicKey: parsed.data.publicKey,
      originHeader: c.req.header("Origin"),
      refererHeader: c.req.header("Referer")
    });
    const conversationId = c.req.param("id");
    // AddMessageUseCase looks the conversation up scoped to this workspaceId and throws
    // ConversationNotFoundError (mapped to 404) if it belongs to a different workspace — that's
    // the whole cross-workspace guard, no separate existence check needed here.
    await container.addMessageUseCase.execute({
      conversationId,
      workspaceId,
      sender: "Customer",
      content: parsed.data.content
    });
    startReplyPipeline(conversationId, workspaceId, parsed.data.content);
    return c.json({ ok: true }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

widgetRoutes.get("/v1/widget/conversations/:id/events", async (c) => {
  const publicKey = c.req.query("publicKey");
  if (!publicKey) {
    return c.json({ error: { code: "validation_error", message: "publicKey query param is required.", requestId: c.get("requestId") } }, 400);
  }

  let workspaceId: string;
  try {
    const result = await container.verifyWidgetOriginUseCase.execute({
      publicKey,
      originHeader: c.req.header("Origin"),
      refererHeader: c.req.header("Referer")
    });
    workspaceId = result.workspaceId;
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }

  const conversationId = c.req.param("id");
  const conversation = await container.conversationRepository.findById(conversationId, workspaceId);
  if (!conversation) {
    return c.json({ error: { code: "not_found", message: "Conversation not found.", requestId: c.get("requestId") } }, 404);
  }

  return streamSSE(c, async (stream) => {
    // The bus is keyed by workspace and mixes every conversation's events together — the widget
    // only ever cares about its own one conversation, so filter here before forwarding.
    const unsubscribe = container.conversationEventBus.subscribe(workspaceId, (event) => {
      if (event.conversationId !== conversationId) return;
      void stream.writeSSE({ data: JSON.stringify(event) });
    });
    stream.onAbort(() => unsubscribe());
    while (!stream.aborted) {
      await stream.sleep(30000);
    }
  });
});
