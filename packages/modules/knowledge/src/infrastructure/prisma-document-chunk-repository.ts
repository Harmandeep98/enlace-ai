import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@enlace/db";
import type { DocumentChunkInput, DocumentChunkRepository } from "../application/ports.js";

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export class PrismaDocumentChunkRepository implements DocumentChunkRepository {
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
}
