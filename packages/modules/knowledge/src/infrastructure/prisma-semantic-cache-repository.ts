import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@enlace/db";
import type { EmbeddingPort, SemanticCacheRepository } from "../application/ports.js";

// Tuned against real Gemini gemini-embedding-001 output (spec §3 flagged 0.85 as a guess before
// a real provider existed): observed cosine similarity was ~0.52 for an unrelated question,
// ~0.71-0.72 for a genuine paraphrase using different words, ~0.89 for a near-duplicate
// (same words, different case/punctuation). 0.65 sits in the gap, with margin on both sides.
// Still a placeholder to retune once real conversation data exists.
const SIMILARITY_THRESHOLD = 0.65;

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export class PrismaSemanticCacheRepository implements SemanticCacheRepository {
  constructor(private readonly embeddings: EmbeddingPort) {}

  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  async findBestMatch(workspaceId: string, message: string): Promise<{ answer: string } | undefined> {
    const embedding = await this.embeddings.embed(message);
    const vectorLiteral = toVectorLiteral(embedding);

    const rows = await this.withTenant(workspaceId, (tx) =>
      tx.$queryRaw<{ answer: string; similarity: number }[]>`
        SELECT answer, 1 - (embedding <=> ${vectorLiteral}::vector) AS similarity
        FROM semantic_cache_entries
        WHERE "workspaceId" = ${workspaceId}
        ORDER BY embedding <=> ${vectorLiteral}::vector
        LIMIT 1
      `
    );

    const best = rows[0];
    if (!best || best.similarity < SIMILARITY_THRESHOLD) return undefined;
    return { answer: best.answer };
  }

  // Prisma's Unsupported("vector(768)") column can't be written through the normal
  // query builder — every column is supplied via raw SQL.
  async save(workspaceId: string, question: string, answer: string): Promise<void> {
    const embedding = await this.embeddings.embed(question);
    const vectorLiteral = toVectorLiteral(embedding);
    const id = randomUUID();

    await this.withTenant(workspaceId, (tx) =>
      tx.$executeRaw`
        INSERT INTO semantic_cache_entries (id, "workspaceId", question, answer, embedding, "createdAt")
        VALUES (${id}, ${workspaceId}, ${question}, ${answer}, ${vectorLiteral}::vector, now())
      `
    );
  }
}
