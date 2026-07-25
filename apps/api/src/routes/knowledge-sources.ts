// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing else.
//
// This route does NOT start the ingestion workflow yet — that call is added in a later slice
// once apps/worker's real crawl workflow exists. Every created source stays "Pending" until then.
import { Hono } from "hono";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";

const createKnowledgeSourceSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(["Website", "Pdf", "Docx", "Markdown", "Txt", "Faq"]),
  origin: z.string().min(1)
});

export const knowledgeSourceRoutes = new Hono<AppEnv>();

knowledgeSourceRoutes.post("/v1/knowledge-sources", async (c) => {
  const parsed = createKnowledgeSourceSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { code: "validation_error", message: parsed.error.message, requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), parsed.data.workspaceId);
    const source = await container.createKnowledgeSourceUseCase.execute(parsed.data);
    return c.json({ source }, 201);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

knowledgeSourceRoutes.get("/v1/knowledge-sources", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) {
    return c.json({ error: { code: "validation_error", message: "workspaceId query param is required.", requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), workspaceId);
    const sources = await container.listKnowledgeSourcesUseCase.execute({ workspaceId });
    return c.json({ sources }, 200);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});

knowledgeSourceRoutes.delete("/v1/knowledge-sources/:id", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) {
    return c.json({ error: { code: "validation_error", message: "workspaceId query param is required.", requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), workspaceId);
    await container.deleteKnowledgeSourceUseCase.execute({ sourceId: c.req.param("id"), workspaceId });
    return c.body(null, 204);
  } catch (error) {
    return mapDomainErrorToResponse(error, c);
  }
});
