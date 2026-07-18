import { NativeConnection } from "@temporalio/worker";
import { createWorker } from "./create-worker.js";

async function run() {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const connection = await NativeConnection.connect({ address });
  try {
    const worker = await createWorker(connection);
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
