import { getTemporalClient, TASK_QUEUES, WORKFLOW_NAMES } from "@enlace/temporal";
import type { IngestionTriggerPort } from "../application/ports.js";

export class TemporalIngestionTrigger implements IngestionTriggerPort {
  async startWebsiteSync(sourceId: string, workspaceId: string, origin: string): Promise<void> {
    const client = await getTemporalClient();
    await client.workflow.start(WORKFLOW_NAMES.KNOWLEDGE_SYNC, {
      args: [sourceId, workspaceId, origin],
      workflowId: `knowledge-sync-${sourceId}`,
      taskQueue: TASK_QUEUES.DEFAULT
    });
  }
}
