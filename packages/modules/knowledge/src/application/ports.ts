import type { FaqEntry, KnowledgeSource, KnowledgeSourceType, KnowledgeSyncStatus } from "../domain/entities.js";

export interface CreateFaqInput {
  workspaceId: string;
  question: string;
  answer: string;
}

export interface FaqRepository {
  create(input: CreateFaqInput): Promise<FaqEntry>;
  listByWorkspace(workspaceId: string): Promise<FaqEntry[]>;
  delete(faqId: string, workspaceId: string): Promise<boolean>;
  findBestMatch(workspaceId: string, message: string): Promise<FaqEntry | undefined>;
}

export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
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
  findById(sourceId: string, workspaceId: string): Promise<KnowledgeSource | undefined>;
  delete(sourceId: string, workspaceId: string): Promise<boolean>;
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
  findBestMatches(workspaceId: string, message: string, k: number): Promise<{ content: string }[]>;
  countBySource(sourceId: string, workspaceId: string): Promise<number>;
}

// Consumer-defined structural port (same pattern as FaqCachePort/SemanticCachePort in
// Conversations) — CreateKnowledgeSourceUseCase depends on this, not on @enlace/temporal
// directly, keeping the application layer free of infrastructure imports.
export interface IngestionTriggerPort {
  startWebsiteSync(sourceId: string, workspaceId: string, origin: string): Promise<void>;
  startFileSync(sourceId: string, workspaceId: string, storageRef: string, fileType: KnowledgeSourceType): Promise<void>;
}

// Consumer-defined structural port (same pattern as IngestionTriggerPort above) — the file
// upload use case depends on this, never on @aws-sdk/client-s3 directly.
export interface FileStoragePort {
  upload(workspaceId: string, sourceId: string, filename: string, content: Buffer, mimeType: string): Promise<string>;
  download(ref: string): Promise<Buffer>;
}
