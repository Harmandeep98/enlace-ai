-- CreateEnum
CREATE TYPE "KnowledgeSourceType" AS ENUM ('Website', 'Pdf', 'Markdown', 'Txt', 'Faq');

-- CreateEnum
CREATE TYPE "KnowledgeSyncStatus" AS ENUM ('Pending', 'Processing', 'Ready', 'Failed');

-- DropIndex
DROP INDEX "semantic_cache_entries_embedding_idx";

-- CreateTable
CREATE TABLE "knowledge_sources" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "KnowledgeSourceType" NOT NULL,
    "origin" TEXT NOT NULL,
    "syncStatus" "KnowledgeSyncStatus" NOT NULL DEFAULT 'Pending',
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "tokenCount" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_sources_workspaceId_idx" ON "knowledge_sources"("workspaceId");

-- CreateIndex
CREATE INDEX "document_chunks_workspaceId_idx" ON "document_chunks"("workspaceId");

-- CreateIndex
CREATE INDEX "document_chunks_sourceId_idx" ON "document_chunks"("sourceId");

-- AddForeignKey
ALTER TABLE "knowledge_sources" ADD CONSTRAINT "knowledge_sources_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate the semantic_cache_entries HNSW index dropped above by Prisma's drift detection
-- (it isn't representable in schema.prisma, so every migration touching that area re-drops it
-- unless hand-restored here).
CREATE INDEX semantic_cache_entries_embedding_idx
  ON "semantic_cache_entries" USING hnsw (embedding vector_cosine_ops);

-- Vector similarity index (docs/06-database-design.md §5) — HNSW isn't expressible via
-- Prisma's @@index, hand-appended same as semantic_cache_entries' index.
CREATE INDEX document_chunks_embedding_idx
  ON "document_chunks" USING hnsw (embedding vector_cosine_ops);

-- Row-Level Security (docs/06-database-design.md §2) — same pattern as every other tenant table.
ALTER TABLE "knowledge_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "knowledge_sources" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "knowledge_sources"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "knowledge_sources" TO enlace_app;

ALTER TABLE "document_chunks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_chunks" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "document_chunks"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "document_chunks" TO enlace_app;
