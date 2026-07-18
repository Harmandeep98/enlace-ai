// Public surface of the Knowledge module (docs/04-folder-structure.md §2).
export type { FaqEntry } from "./domain/entities.js";
export { findBestFaqMatch } from "./domain/matching.js";

export type { CreateFaqInput, FaqRepository } from "./application/ports.js";
export { CreateFaqUseCase } from "./application/create-faq-use-case.js";
export { ListFaqsUseCase } from "./application/list-faqs-use-case.js";
export type { ListFaqsInput } from "./application/list-faqs-use-case.js";

export { PrismaFaqRepository } from "./infrastructure/prisma-faq-repository.js";

export type { SemanticCacheEntry } from "./domain/entities.js";
export type { EmbeddingPort, SemanticCacheRepository } from "./application/ports.js";
export { PrismaSemanticCacheRepository } from "./infrastructure/prisma-semantic-cache-repository.js";

export type { DocumentChunk, KnowledgeSource, KnowledgeSourceType, KnowledgeSyncStatus } from "./domain/entities.js";
export type {
  CreateKnowledgeSourceInput,
  DocumentChunkInput,
  DocumentChunkRepository,
  KnowledgeSourceRepository
} from "./application/ports.js";
export { CreateKnowledgeSourceUseCase } from "./application/create-knowledge-source-use-case.js";
export { ListKnowledgeSourcesUseCase } from "./application/list-knowledge-sources-use-case.js";
export type { ListKnowledgeSourcesInput } from "./application/list-knowledge-sources-use-case.js";

export { PrismaKnowledgeSourceRepository } from "./infrastructure/prisma-knowledge-source-repository.js";
export { PrismaDocumentChunkRepository } from "./infrastructure/prisma-document-chunk-repository.js";
