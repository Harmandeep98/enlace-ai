import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@enlace/db";
import type { DocumentChunkInput, DocumentChunkRepository, EmbeddingPort } from "../application/ports.js";

// Placeholder, per spec §3 — looser than semantic cache's 0.65 deliberately: retrieval's job
// is "here's relevant material," not "this exact question was asked before." Retune once real
// conversation data exists.
const SIMILARITY_THRESHOLD = 0.5;
const DEFAULT_K = 3;

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export class PrismaDocumentChunkRepository implements DocumentChunkRepository {
  constructor(private readonly embeddings: EmbeddingPort) {}

  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  // Prisma's Unsupported("vector(768)") column can't be written through the normal query
  // builder — every column is supplied via raw SQL, one insert per chunk within the same
  // tenant-scoped transaction (chunk counts per page are small, this isn't a hot loop).
  async insertMany(workspaceId: string, sourceId: string, chunks: DocumentChunkInput[]): Promise<void> {
    await this.withTenant(workspaceId, async (tx) => {
      for (const chunk of chunks) {
        const id = randomUUID();
        const vectorLiteral = toVectorLiteral(chunk.embedding);
        await tx.$executeRaw`
          INSERT INTO document_chunks (id, "workspaceId", "sourceId", content, embedding, "tokenCount", "contentHash", "createdAt")
          VALUES (${id}, ${workspaceId}, ${sourceId}, ${chunk.content}, ${vectorLiteral}::vector, ${chunk.tokenCount}, ${chunk.contentHash}, now())
        `;
      }
    });
  }

  // docs/12-knowledge-architecture.md §6 — a workspace's whole Ready chunk set is searched
  // together, one similarity search, not per-source. Joined against knowledge_sources so a
  // source still Processing/Failed never contributes chunks to the result.
  async findBestMatches(workspaceId: string, message: string, k: number = DEFAULT_K): Promise<{ content: string }[]> {
    const embedding = await this.embeddings.embed(message);
    const vectorLiteral = toVectorLiteral(embedding);

    const rows = await this.withTenant(workspaceId, (tx) =>
      tx.$queryRaw<{ content: string; similarity: number }[]>`
        SELECT dc.content, 1 - (dc.embedding <=> ${vectorLiteral}::vector) AS similarity
        FROM document_chunks dc
        JOIN knowledge_sources ks ON ks.id = dc."sourceId"
        WHERE dc."workspaceId" = ${workspaceId} AND ks."syncStatus" = 'Ready'
        ORDER BY dc.embedding <=> ${vectorLiteral}::vector
        LIMIT ${k}
      `
    );

    return rows.filter((row) => row.similarity >= SIMILARITY_THRESHOLD).map((row) => ({ content: row.content }));
  }

  async countBySource(sourceId: string, workspaceId: string): Promise<number> {
    return this.withTenant(workspaceId, (tx) => tx.documentChunk.count({ where: { sourceId, workspaceId } }));
  }
}
