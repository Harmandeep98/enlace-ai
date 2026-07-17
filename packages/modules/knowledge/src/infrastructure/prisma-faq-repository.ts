import { Prisma, prisma } from "@enlace/db";
import { findBestFaqMatch } from "../domain/matching.js";
import type { FaqEntry } from "../domain/entities.js";
import type { CreateFaqInput, FaqRepository } from "../application/ports.js";

function toFaqEntry(row: { id: string; workspaceId: string; question: string; answer: string }): FaqEntry {
  return { id: row.id, workspaceId: row.workspaceId, question: row.question, answer: row.answer };
}

export class PrismaFaqRepository implements FaqRepository {
  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  async create(input: CreateFaqInput): Promise<FaqEntry> {
    const row = await this.withTenant(input.workspaceId, (tx) =>
      tx.faqEntry.create({ data: { workspaceId: input.workspaceId, question: input.question, answer: input.answer } })
    );
    return toFaqEntry(row);
  }

  async listByWorkspace(workspaceId: string): Promise<FaqEntry[]> {
    const rows = await this.withTenant(workspaceId, (tx) => tx.faqEntry.findMany({ where: { workspaceId } }));
    return rows.map(toFaqEntry);
  }

  // docs/16-cost-optimization-strategy.md §2 — keyword match, not embeddings: fetch the
  // workspace's FAQs and run the pure matching algorithm (Task 2), tested once in isolation.
  async findBestMatch(workspaceId: string, message: string): Promise<FaqEntry | undefined> {
    const entries = await this.listByWorkspace(workspaceId);
    return findBestFaqMatch(message, entries);
  }
}
