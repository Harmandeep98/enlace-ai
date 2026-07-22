import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { getTemporalClient } from "@enlace/temporal";
import { TemporalZendeskSyncTrigger } from "./temporal-zendesk-sync-trigger.js";

// Hits the real local Temporal server (docker-compose) — same as every worker-side Temporal
// test this session, no mocking framework.
describe("TemporalZendeskSyncTrigger", () => {
  it("creates a real Temporal Schedule that would periodically start the Zendesk sync workflow", async () => {
    const trigger = new TemporalZendeskSyncTrigger();
    const workspaceId = `workspace-${randomUUID()}`;
    const connectionId = `connection-${randomUUID()}`;

    await trigger.scheduleSync(workspaceId, connectionId);

    const client = await getTemporalClient();
    const handle = client.schedule.getHandle(`zendesk-sync-${connectionId}`);
    const description = await handle.describe();
    expect(description.action.workflowType).toBe("zendeskSyncWorkflow");

    await handle.delete();
  }, 15000);
});
