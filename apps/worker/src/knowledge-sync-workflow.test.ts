import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { NativeConnection } from "@temporalio/worker";
import { prisma } from "@enlace/db";
import { PrismaKnowledgeSourceRepository } from "@enlace/knowledge";
import { getTemporalClient, TASK_QUEUES, WORKFLOW_NAMES } from "@enlace/temporal";
import { createWorker } from "./create-worker.js";
import { startTestSite } from "./test-support/test-site.js";

describe("knowledgeSyncWorkflow", () => {
  const sources = new PrismaKnowledgeSourceRepository();

  afterEach(async () => {
    await prisma.documentChunk.deleteMany();
    await prisma.knowledgeSource.deleteMany();
    await prisma.workspace.deleteMany();
  });

  it(
    "crawls a small real site end-to-end and lands as Ready with real chunks stored",
    async () => {
      const site = await startTestSite();
      const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
      const connection = await NativeConnection.connect({ address });

      try {
        const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
        const source = await sources.create({ workspaceId: workspace.id, type: "Website", origin: site.baseUrl });

        const worker = await createWorker(connection);
        const client = await getTemporalClient();

        await worker.runUntil(
          client.workflow.execute(WORKFLOW_NAMES.KNOWLEDGE_SYNC, {
            args: [source.id, workspace.id, site.baseUrl],
            workflowId: `knowledge-sync-${randomUUID()}`,
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
        await site.close();
      }
    },
    60000
  );
});
