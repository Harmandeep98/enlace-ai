-- AlterEnum
ALTER TYPE "ResolutionPath" ADD VALUE 'Escalated';

-- DropIndex
DROP INDEX "document_chunks_embedding_idx";

-- DropIndex
DROP INDEX "semantic_cache_entries_embedding_idx";
