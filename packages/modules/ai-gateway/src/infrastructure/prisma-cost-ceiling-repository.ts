import { Prisma, prisma } from "@enlace/db";
import type { CostCeilingRepository } from "../application/ports.js";

function currentPeriodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export class PrismaCostCeilingRepository implements CostCeilingRepository {
  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  async getTokensSpentThisPeriod(workspaceId: string): Promise<number> {
    const periodStart = currentPeriodStart();
    const row = await this.withTenant(workspaceId, (tx) =>
      tx.aiUsageCounter.findUnique({ where: { workspaceId_periodStart: { workspaceId, periodStart } } })
    );
    return row?.tokensSpent ?? 0;
  }

  async addTokens(workspaceId: string, tokens: number): Promise<void> {
    const periodStart = currentPeriodStart();
    await this.withTenant(workspaceId, (tx) =>
      tx.aiUsageCounter.upsert({
        where: { workspaceId_periodStart: { workspaceId, periodStart } },
        create: { workspaceId, periodStart, tokensSpent: tokens },
        update: { tokensSpent: { increment: tokens } }
      })
    );
  }
}
