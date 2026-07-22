import { getTemporalClient, TASK_QUEUES, WORKFLOW_NAMES } from "@enlace/temporal";
import type { ZendeskSyncTriggerPort } from "../application/ports.js";

// Zendesk ticket status changes made directly in Zendesk (a human resolving a ticket) need to
// be reconciled onto the linked Conversation — polling every 15 minutes is the deliberate v1
// choice (docs/14-integration-architecture.md §4: zero-setup for the customer, at the cost of
// not being instant).
const SYNC_INTERVAL = "15m";

export class TemporalZendeskSyncTrigger implements ZendeskSyncTriggerPort {
  async scheduleSync(workspaceId: string, connectionId: string): Promise<void> {
    const client = await getTemporalClient();
    await client.schedule.create({
      scheduleId: `zendesk-sync-${connectionId}`,
      spec: { intervals: [{ every: SYNC_INTERVAL }] },
      action: {
        type: "startWorkflow",
        workflowType: WORKFLOW_NAMES.ZENDESK_SYNC,
        taskQueue: TASK_QUEUES.DEFAULT,
        args: [workspaceId],
        workflowId: `zendesk-sync-run-${connectionId}`
      }
    });
  }
}
