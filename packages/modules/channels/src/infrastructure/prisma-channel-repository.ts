import { prisma } from "@enlace/db";
import type { ChannelConnection } from "../domain/entities.js";
import type { ChannelRepository } from "../application/ports.js";

export class PrismaChannelRepository implements ChannelRepository {
  // No prior request-level tenant context exists yet at this call site (createDefaultWidget
  // runs during signup, for a workspace that didn't exist a moment ago) — same situation as
  // PrismaMembershipRepository's first-insert problem, same fix (docs/06-database-design.md §2).
  async createDefaultWidget(workspaceId: string): Promise<ChannelConnection> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return tx.channelConnection.create({ data: { workspaceId, type: "Widget" } });
    });
    return { id: row.id, workspaceId: row.workspaceId, type: row.type };
  }
}
