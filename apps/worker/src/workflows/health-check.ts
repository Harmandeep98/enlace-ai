import { proxyActivities } from "@temporalio/workflow";
// Only import the activity's types — workflow code must never import the activity
// implementation directly (Temporal's determinism rule; the real implementation runs
// outside the workflow's sandboxed V8 isolate).
import type * as activities from "../activities/health-check.js";

const { echo } = proxyActivities<typeof activities>({
  startToCloseTimeout: "1 minute"
});

export async function healthCheckWorkflow(input: string): Promise<string> {
  return await echo(input);
}
