import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { NativeConnection } from "@temporalio/worker";
import { prisma } from "@enlace/db";
import { PrismaKnowledgeSourceRepository, S3FileStorageAdapter } from "@enlace/knowledge";
import { getTemporalClient, TASK_QUEUES, WORKFLOW_NAMES } from "@enlace/temporal";
import { createWorker } from "./create-worker.js";

// Real Temporal + real S3 (the workflow downloads the file from the real bucket) — skipped
// without a configured bucket, same gating as s3-file-storage-adapter.test.ts.
const maybeIt = process.env.AWS_S3_KNOWLEDGE_BUCKET ? it : it.skip;

describe("fileSyncWorkflow", () => {
  const sources = new PrismaKnowledgeSourceRepository();
  const storage = new S3FileStorageAdapter();

  afterEach(async () => {
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.workspace.deleteMany();
  });

  maybeIt(
    "downloads a real Txt file from S3, extracts and stores chunks, and lands as Ready",
    async () => {
      const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
      const connection = await NativeConnection.connect({ address });

      try {
        const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
        const source = await sources.create({ workspaceId: workspace.id, type: "Txt", origin: "notes.txt" });
        const storageRef = await storage.upload(
          workspace.id,
          source.id,
          "notes.txt",
          Buffer.from("Our return policy allows returns within 30 days of purchase."),
          "text/plain"
        );

        const worker = await createWorker(connection);
        const client = await getTemporalClient();

        await worker.runUntil(
          client.workflow.execute(WORKFLOW_NAMES.FILE_SYNC, {
            args: [source.id, workspace.id, storageRef, "Txt"],
            workflowId: `file-sync-${randomUUID()}`,
            taskQueue: TASK_QUEUES.DEFAULT
          })
        );

        const [updated] = await sources.listByWorkspace(workspace.id);
        expect(updated?.syncStatus).toBe("Ready");

        const chunkRows = await prisma.$transaction(async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
          return tx.$queryRaw<{ id: string }[]>`SELECT id FROM document_chunks WHERE "sourceId" = ${source.id}`;
        });
        expect(chunkRows.length).toBeGreaterThan(0);
      } finally {
        await connection.close();
      }
    },
    60000
  );
});
