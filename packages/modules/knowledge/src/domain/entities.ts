// docs/05-domain-model.md §6 — domain-facing type, independent of the Prisma schema shape.
// Deliberately just FAQ content for this slice — DocumentChunk/embeddings are a later Knowledge slice.
export interface FaqEntry {
  id: string;
  workspaceId: string;
  question: string;
  answer: string;
}

// No `embedding` field — embedding is an infrastructure concern, never surfaced above the
// repository (same reasoning as document_chunks never exposing its vector to the domain layer).
export interface SemanticCacheEntry {
  id: string;
  workspaceId: string;
  question: string;
  answer: string;
}

export type KnowledgeSourceType = "Website" | "Pdf" | "Docx" | "Markdown" | "Txt" | "Faq";
export type KnowledgeSyncStatus = "Pending" | "Processing" | "Ready" | "Failed";

export interface KnowledgeSource {
  id: string;
  workspaceId: string;
  type: KnowledgeSourceType;
  origin: string;
  syncStatus: KnowledgeSyncStatus;
  lastSyncedAt: Date | null;
}

// No `embedding`/`contentHash` — infrastructure concerns, never surfaced above the repository
// (same reasoning as SemanticCacheEntry).
export interface DocumentChunk {
  id: string;
  workspaceId: string;
  sourceId: string;
  content: string;
  tokenCount: number;
}
