import { prisma } from "@enlace/db";
import type { ChannelConnection } from "../domain/entities.js";
import type { ChannelRepository } from "../application/ports.js";

function toChannelConnection(row: {
  id: string;
  workspaceId: string;
  type: string;
  publicKey: string;
  allowedDomains: string[];
}): ChannelConnection {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as ChannelConnection["type"],
    publicKey: row.publicKey,
    allowedDomains: row.allowedDomains
  };
}

export class PrismaChannelRepository implements ChannelRepository {
  // No prior request-level tenant context exists yet at this call site (createDefaultWidget
  // runs during signup, for a workspace that didn't exist a moment ago) — same situation as
  // PrismaMembershipRepository's first-insert problem, same fix (docs/06-database-design.md §2).
  async createDefaultWidget(workspaceId: string): Promise<ChannelConnection> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return tx.channelConnection.create({ data: { workspaceId, type: "Widget" } });
    });
    return toChannelConnection(row);
  }

  async findByWorkspace(workspaceId: string): Promise<ChannelConnection | undefined> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return tx.channelConnection.findFirst({ where: { workspaceId } });
    });
    return row ? toChannelConnection(row) : undefined;
  }

  // Deliberately the one method in this repository that does NOT set app.workspace_id first —
  // resolving a public key to its workspace is the whole point, so the workspace can't be known
  // in advance. The widened RLS policy (Task 1) allows this specific lookup path instead.
  async findByPublicKey(publicKey: string): Promise<ChannelConnection | undefined> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.public_key', ${publicKey}, true)`;
      return tx.channelConnection.findUnique({ where: { publicKey } });
    });
    return row ? toChannelConnection(row) : undefined;
  }

  async updateAllowedDomains(workspaceId: string, domains: string[]): Promise<ChannelConnection> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      const existing = await tx.channelConnection.findFirstOrThrow({ where: { workspaceId } });
      return tx.channelConnection.update({ where: { id: existing.id }, data: { allowedDomains: domains } });
    });
    return toChannelConnection(row);
  }
}
