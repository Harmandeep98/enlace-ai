import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/file-sync.js";
import type { KnowledgeSourceType } from "@enlace/knowledge";

const { markFileSyncStatus, finalizeFileSync } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes"
});
const { ingestFile } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: { maximumAttempts: 3 }
});

export async function fileSyncWorkflow(
  sourceId: string,
  workspaceId: string,
  storageRef: string,
  fileType: KnowledgeSourceType
): Promise<void> {
  await markFileSyncStatus(sourceId, workspaceId, "Processing");

  let success = false;
  try {
    const result = await ingestFile(workspaceId, sourceId, storageRef, fileType);
    success = result.success;
  } catch {
    success = false;
  }

  await finalizeFileSync(sourceId, workspaceId, success);
}
