import { Prisma, prisma } from "@enlace/db";
import type { KnowledgeSource, KnowledgeSyncStatus } from "../domain/entities.js";
import type { CreateKnowledgeSourceInput, KnowledgeSourceRepository } from "../application/ports.js";

function toKnowledgeSource(row: {
  id: string;
  workspaceId: string;
  type: string;
  origin: string;
  syncStatus: string;
  lastSyncedAt: Date | null;
}): KnowledgeSource {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as KnowledgeSource["type"],
    origin: row.origin,
    syncStatus: row.syncStatus as KnowledgeSyncStatus,
    lastSyncedAt: row.lastSyncedAt
  };
}

export class PrismaKnowledgeSourceRepository implements KnowledgeSourceRepository {
  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  async create(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    const row = await this.withTenant(input.workspaceId, (tx) =>
      tx.knowledgeSource.create({
        data: { workspaceId: input.workspaceId, type: input.type, origin: input.origin }
      })
    );
    return toKnowledgeSource(row);
  }

  async listByWorkspace(workspaceId: string): Promise<KnowledgeSource[]> {
    const rows = await this.withTenant(workspaceId, (tx) => tx.knowledgeSource.findMany({ where: { workspaceId } }));
    return rows.map(toKnowledgeSource);
  }

  async findById(sourceId: string, workspaceId: string): Promise<KnowledgeSource | undefined> {
    const row = await this.withTenant(workspaceId, (tx) => tx.knowledgeSource.findUnique({ where: { id: sourceId } }));
    return row ? toKnowledgeSource(row) : undefined;
  }

  async delete(sourceId: string, workspaceId: string): Promise<boolean> {
    const result = await this.withTenant(workspaceId, (tx) =>
      tx.knowledgeSource.deleteMany({ where: { id: sourceId, workspaceId } })
    );
    return result.count > 0;
  }

  async updateSyncStatus(
    sourceId: string,
    workspaceId: string,
    syncStatus: KnowledgeSyncStatus,
    lastSyncedAt: Date | undefined
  ): Promise<void> {
    await this.withTenant(workspaceId, (tx) =>
      tx.knowledgeSource.update({
        where: { id: sourceId },
        data: { syncStatus, lastSyncedAt }
      })
    );
  }
}
