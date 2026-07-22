import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/zendesk-sync.js";

const { syncZendeskTickets } = proxyActivities<typeof activities>({
  startToCloseTimeout: "2 minutes",
  retry: { maximumAttempts: 3 }
});

export async function zendeskSyncWorkflow(workspaceId: string): Promise<void> {
  await syncZendeskTickets(workspaceId);
}
