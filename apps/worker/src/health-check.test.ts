import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NativeConnection } from "@temporalio/worker";
import { getTemporalClient, TASK_QUEUES } from "@enlace/temporal";
import { createWorker } from "./create-worker.js";
import { healthCheckWorkflow } from "./workflows/health-check.js";

describe("healthCheckWorkflow", () => {
  it("runs end-to-end against the real local Temporal server", async () => {
    const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
    const connection = await NativeConnection.connect({ address });

    try {
      const worker = await createWorker(connection);
      const client = await getTemporalClient();

      // worker.runUntil scopes the in-process Worker's polling lifetime to exactly this
      // one workflow execution — no separately-running `apps/worker dev` process needed,
      // and no test-only mock server either: this is the real docker-compose Temporal.
      const result = await worker.runUntil(
        client.workflow.execute(healthCheckWorkflow, {
          args: ["hello"],
          workflowId: `health-check-${randomUUID()}`,
          taskQueue: TASK_QUEUES.DEFAULT
        })
      );

      expect(result).toBe("HELLO");
    } finally {
      await connection.close();
    }
  });
});
