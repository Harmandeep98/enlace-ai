import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/knowledge-sync.js";

const { markSyncStatus, discoverPages, finalizeSync } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes"
});

// A shorter, bounded retry policy specifically for ingestPage: a transient failure (e.g. a
// Gemini rate-limit response) gets Temporal's automatic exponential-backoff retry, but only up
// to 3 attempts — after that, the workflow's own loop below counts the page as failed instead
// of retrying forever (Global Constraints — rate-limit resilience via activity retry).
const { ingestPage } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: { maximumAttempts: 3 }
});

export async function knowledgeSyncWorkflow(sourceId: string, workspaceId: string, url: string): Promise<void> {
  await markSyncStatus(sourceId, workspaceId, "Processing");

  let pageUrls: string[];
  try {
    pageUrls = await discoverPages(url);
  } catch {
    // Page discovery (sitemap/robots.txt) failed even after retries — the site itself is
    // unreachable, a real failure (docs/12-knowledge-architecture.md §2), not one broken page
    // among many.
    await markSyncStatus(sourceId, workspaceId, "Failed");
    return;
  }

  let failedPages = 0;
  for (const pageUrl of pageUrls) {
    try {
      const result = await ingestPage(workspaceId, sourceId, pageUrl);
      if (!result.success) failedPages++;
    } catch {
      failedPages++;
    }
  }

  await finalizeSync(sourceId, workspaceId, pageUrls.length, failedPages);
}
