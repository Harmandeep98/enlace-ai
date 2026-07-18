import { Client, Connection } from "@temporalio/client";

export async function getTemporalClient(): Promise<Client> {
  const address = process.env.TEMPORAL_ADDRESS ?? "localhost:7233";
  const connection = await Connection.connect({ address });
  return new Client({ connection });
}
