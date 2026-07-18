import path from "node:path";
import { NativeConnection, Worker } from "@temporalio/worker";
import { TASK_QUEUES } from "@enlace/temporal";
import * as healthCheckActivities from "./activities/health-check.js";
import * as knowledgeSyncActivities from "./activities/knowledge-sync.js";

// Computed relative to process.cwd() (the package root, true whether invoked via
// `pnpm --filter @enlace/worker dev/test`), not import.meta.url — this way the same path
// resolves correctly under tsx (dev) and vitest (test) alike. Temporal's own internal bundler
// compiles this .ts file itself; it does not need to be pre-built.
const WORKFLOWS_PATH = path.resolve(process.cwd(), "src/workflows/index.ts");

export async function createWorker(connection: NativeConnection): Promise<Worker> {
  return Worker.create({
    connection,
    namespace: "default",
    taskQueue: TASK_QUEUES.DEFAULT,
    workflowsPath: WORKFLOWS_PATH,
    activities: { ...healthCheckActivities, ...knowledgeSyncActivities }
  });
}
