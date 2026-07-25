import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { S3FileStorageAdapter } from "./s3-file-storage-adapter.js";

// Hits real S3 — skipped without a configured bucket, same gating this repo already applies
// to Gemini-API-dependent tests (packages/modules/ai-gateway/src/infrastructure/gemini-embedding-adapter.test.ts).
const maybeIt = process.env.AWS_S3_KNOWLEDGE_BUCKET ? it : it.skip;

describe("S3FileStorageAdapter", () => {
  maybeIt("uploads a file to real S3 and downloads the exact same bytes back", async () => {
    const adapter = new S3FileStorageAdapter();
    const workspaceId = `test-workspace-${randomUUID()}`;
    const sourceId = `test-source-${randomUUID()}`;
    const content = Buffer.from("Hello from a real S3 integration test.");

    const ref = await adapter.upload(workspaceId, sourceId, "test.txt", content, "text/plain");
    const downloaded = await adapter.download(ref);

    expect(downloaded.toString("utf-8")).toBe(content.toString("utf-8"));
    expect(ref).toBe(`workspaces/${workspaceId}/knowledge-sources/${sourceId}/test.txt`);
  });
});
