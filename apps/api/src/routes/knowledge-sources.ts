// docs/07-api-design.md §4 — a route validates, calls one use case, maps the result. Nothing else.
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { container } from "../composition/container.js";
import { mapDomainErrorToResponse } from "../middleware/error-handler.js";
import type { AppEnv } from "../types.js";
import type { KnowledgeSourceType } from "@enlace/knowledge";

const createKnowledgeSourceSchema = z.object({
  workspaceId: z.string().min(1),
  type: z.enum(["Website", "Pdf", "Docx", "Markdown", "Txt", "Faq"]),
  origin: z.string().min(1)
});

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const EXTENSION_TO_TYPE: Record<string, KnowledgeSourceType> = {
  pdf: "Pdf",
  docx: "Docx",
  txt: "Txt",
  md: "Markdown"
};

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

knowledgeSourceRoutes.post(
  "/v1/knowledge-sources/upload",
  bodyLimit({
    maxSize: MAX_UPLOAD_BYTES,
    onError: (c) =>
      c.json({ error: { code: "validation_error", message: "File exceeds the 20MB limit.", requestId: c.get("requestId") } }, 400)
  }),
  async (c) => {
    const body = await c.req.parseBody();
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : undefined;
    const file = body.file;

    if (!workspaceId) {
      return c.json({ error: { code: "validation_error", message: "workspaceId is required.", requestId: c.get("requestId") } }, 400);
    }
    if (!(file instanceof File)) {
      return c.json({ error: { code: "validation_error", message: "A file is required.", requestId: c.get("requestId") } }, 400);
    }

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    const type = EXTENSION_TO_TYPE[extension];
    if (!type) {
      return c.json(
        { error: { code: "validation_error", message: "Only PDF, DOCX, TXT, and MD files are supported.", requestId: c.get("requestId") } },
        400
      );
    }

    try {
      await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), workspaceId);
      const content = Buffer.from(await file.arrayBuffer());
      const source = await container.uploadKnowledgeSourceUseCase.execute({
        workspaceId,
        type,
        filename: file.name,
        content,
        mimeType: file.type || "application/octet-stream"
      });
      return c.json({ source }, 201);
    } catch (error) {
      return mapDomainErrorToResponse(error, c);
    }
  }
);

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

knowledgeSourceRoutes.get("/v1/knowledge-sources/:id", async (c) => {
  const workspaceId = c.req.query("workspaceId");
  if (!workspaceId) {
    return c.json({ error: { code: "validation_error", message: "workspaceId query param is required.", requestId: c.get("requestId") } }, 400);
  }

  try {
    await container.verifyWorkspaceMembershipUseCase.execute(c.get("userId"), workspaceId);
    const source = await container.getKnowledgeSourceUseCase.execute({ sourceId: c.req.param("id"), workspaceId });
    return c.json({ source }, 200);
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
