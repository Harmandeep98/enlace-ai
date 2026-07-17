// docs/05-domain-model.md §6 — domain-facing type, independent of the Prisma schema shape.
// Deliberately just FAQ content for this slice — DocumentChunk/embeddings are a later Knowledge slice.
export interface FaqEntry {
  id: string;
  workspaceId: string;
  question: string;
  answer: string;
}
