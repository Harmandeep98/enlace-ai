import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { NativeConnection } from "@temporalio/worker";
import { prisma } from "@enlace/db";
import { PrismaConversationRepository } from "@enlace/conversations";
import { PrismaIntegrationConnectionRepository } from "@enlace/integrations";
import { getTemporalClient, TASK_QUEUES, WORKFLOW_NAMES } from "@enlace/temporal";
import { createWorker } from "./create-worker.js";

// Hits the real Zendesk API through the activity — skipped without sandbox credentials, same
// gating this repo already applies to every other real-external-service test this session.
const maybeIt = process.env.ZENDESK_SUBDOMAIN && process.env.ZENDESK_EMAIL && process.env.ZENDESK_API_KEY ? it : it.skip;

describe("zendeskSyncWorkflow", () => {
  const integrationConnections = new PrismaIntegrationConnectionRepository();
  const conversations = new PrismaConversationRepository();

  afterEach(async () => {
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.channelConnection.deleteMany();
    await prisma.integrationConnection.deleteMany();
    await prisma.workspace.deleteMany();
  });

  maybeIt(
    "reconciles a real solved Zendesk ticket onto its linked Conversation",
    async () => {
      const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
      const channel = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspace.id}, true)`;
        return tx.channelConnection.create({ data: { workspaceId: workspace.id, type: "Widget" } });
      });
      const { conversation } = await conversations.create({
        workspaceId: workspace.id,
        channelId: channel.id,
        customerRef: "customer-1",
        message: "I need a human."
      });

      await integrationConnections.create({
        workspaceId: workspace.id,
        type: "Zendesk",
        config: { subdomain: process.env.ZENDESK_SUBDOMAIN, email: process.env.ZENDESK_EMAIL },
        credential: process.env.ZENDESK_API_KEY
      });

      // This test assumes a ticket with external_id === conversation.id already exists and is
      // solved in the real sandbox — creating and resolving one here would require Zendesk's
      // agent-side "solve" action, which isn't automatable through the public API alone. Real
      // sandbox setup for this test is tracked separately; until then this documents the exact
      // real-API contract sync() relies on.
      const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
      const connection = await NativeConnection.connect({ address });
      try {
        const worker = await createWorker(connection);
        const client = await getTemporalClient();
        await worker.runUntil(
          client.workflow.execute(WORKFLOW_NAMES.ZENDESK_SYNC, {
            args: [workspace.id],
            workflowId: `zendesk-sync-test-${randomUUID()}`,
            taskQueue: TASK_QUEUES.DEFAULT
          })
        );
      } finally {
        await connection.close();
      }

      const updated = await conversations.findById(conversation.id, workspace.id);
      expect(updated?.status).toBe("Resolved");
    },
    30000
  );
});
