// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing else.
import { Hono } from "hono";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const createFaqSchema = z.object({
  workspaceId: z.string().min(1),
  question: z.string().min(1),
  answer: z.string().min(1)
});

export const faqRoutes = new Hono<AppEnv>();

faqRoutes.post("/v1/faqs", async (c) => {
  const parsed = createFaqSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    const faq = await container.createFaqUseCase.execute(parsed.data);
    return c.json({ faq }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

faqRoutes.get("/v1/faqs", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) {
    return c.json({ error: { code: "validation_error", message: "workspaceId query param is required.", requestId: c.get("requestId") } }, 400);
  }

  try {
    const faqs = await container.listFaqsUseCase.execute({ workspaceId });
    return c.json({ faqs }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});
