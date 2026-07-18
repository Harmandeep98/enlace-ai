import type { FaqEntry, KnowledgeSource, KnowledgeSourceType, KnowledgeSyncStatus } from "../domain/entities.js";

export interface CreateFaqInput {
  workspaceId: string;
  question: string;
  answer: string;
}

export interface FaqRepository {
  create(input: CreateFaqInput): Promise<FaqEntry>;
  listByWorkspace(workspaceId: string): Promise<FaqEntry[]>;
  findBestMatch(workspaceId: string, message: string): Promise<FaqEntry | undefined>;
}

export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
}

export interface SemanticCacheRepository {
  findBestMatch(workspaceId: string, message: string): Promise<{ answer: string } | undefined>;
  save(workspaceId: string, question: string, answer: string): Promise<void>;
}

export interface CreateKnowledgeSourceInput {
  workspaceId: string;
  type: KnowledgeSourceType;
  origin: string;
}

export interface KnowledgeSourceRepository {
  create(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource>;
  listByWorkspace(workspaceId: string): Promise<KnowledgeSource[]>;
  updateSyncStatus(
    sourceId: string,
    workspaceId: string,
    syncStatus: KnowledgeSyncStatus,
    lastSyncedAt: Date | undefined
  ): Promise<void>;
}

export interface DocumentChunkInput {
  content: string;
  embedding: number[];
  tokenCount: number;
  contentHash: string;
}

export interface DocumentChunkRepository {
  insertMany(workspaceId: string, sourceId: string, chunks: DocumentChunkInput[]): Promise<void>;
}
