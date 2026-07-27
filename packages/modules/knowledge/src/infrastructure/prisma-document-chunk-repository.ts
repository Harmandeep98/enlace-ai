import { randomUUID } from "node:crypto";
import { Prisma, prisma } from "@enlace/db";
import type { DocumentChunkInput, DocumentChunkRepository, EmbeddingPort } from "../application/ports.js";

// Placeholder, per spec §3 — looser than semantic cache's 0.65 deliberately: retrieval's job
// is "here's relevant material," not "this exact question was asked before." Retune once real
// conversation data exists.
const SIMILARITY_THRESHOLD = 0.5;
const DEFAULT_K = 5;
// How many top-similarity candidates MMR re-ranks over before picking the final k — wide enough
// to give the diversity step real options, small enough to stay a cheap single query.
const CANDIDATE_POOL_SIZE = 20;
// Balanced relevance/diversity trade-off (Carbonell & Goldstein's original MMR paper suggests
// 0.5-0.7 depending on how much diversity matters) — 0.5 weighs a chunk's own relevance equally
// against how different it is from what's already been picked.
const MMR_LAMBDA = 0.5;

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

function parseVectorLiteral(literal: string): number[] {
  return literal.slice(1, -1).split(",").map(Number);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Maximal Marginal Relevance — greedily picks the next candidate that's both relevant to the
// query and dissimilar to what's already selected, so k results cover more distinct ground
// instead of returning several near-duplicate chunks from a source that repeats itself.
function selectByMmr(
  candidates: { content: string; embedding: number[]; similarity: number }[],
  k: number
): { content: string }[] {
  const remaining = [...candidates];
  const selected: typeof candidates = [];

  while (selected.length < k && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i]!;
      const maxSimToSelected =
        selected.length === 0 ? 0 : Math.max(...selected.map((s) => cosineSimilarity(candidate.embedding, s.embedding)));
      const score = MMR_LAMBDA * candidate.similarity - (1 - MMR_LAMBDA) * maxSimToSelected;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    selected.push(remaining[bestIndex]!);
    remaining.splice(bestIndex, 1);
  }

  return selected.map((c) => ({ content: c.content }));
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
  // source still Processing/Failed never contributes chunks to the result. Fetches a wider
  // CANDIDATE_POOL_SIZE by raw similarity, then re-ranks down to k via MMR so the final result
  // set isn't just k near-identical chunks from a source that repeats itself.
  async findBestMatches(workspaceId: string, message: string, k: number = DEFAULT_K): Promise<{ content: string }[]> {
    const embedding = await this.embeddings.embed(message);
    const vectorLiteral = toVectorLiteral(embedding);

    const rows = await this.withTenant(workspaceId, (tx) =>
      tx.$queryRaw<{ content: string; embedding: string; similarity: number }[]>`
        SELECT dc.content, dc.embedding::text AS embedding, 1 - (dc.embedding <=> ${vectorLiteral}::vector) AS similarity
        FROM document_chunks dc
        JOIN knowledge_sources ks ON ks.id = dc."sourceId"
        WHERE dc."workspaceId" = ${workspaceId} AND ks."syncStatus" = 'Ready'
        ORDER BY dc.embedding <=> ${vectorLiteral}::vector
        LIMIT ${CANDIDATE_POOL_SIZE}
      `
    );

    const candidates = rows
      .filter((row) => row.similarity >= SIMILARITY_THRESHOLD)
      .map((row) => ({ content: row.content, embedding: parseVectorLiteral(row.embedding), similarity: row.similarity }));

    return selectByMmr(candidates, k);
  }

  async countBySource(sourceId: string, workspaceId: string): Promise<number> {
    return this.withTenant(workspaceId, (tx) => tx.documentChunk.count({ where: { sourceId, workspaceId } }));
  }
}
