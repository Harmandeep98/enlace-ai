-- DropIndex
DROP INDEX "document_chunks_embedding_idx";

-- DropIndex
DROP INDEX "semantic_cache_entries_embedding_idx";

-- CreateTable
CREATE TABLE "ai_usage_counters" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "tokensSpent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_usage_counters_workspaceId_idx" ON "ai_usage_counters"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_counters_workspaceId_periodStart_key" ON "ai_usage_counters"("workspaceId", "periodStart");

-- AddForeignKey
ALTER TABLE "ai_usage_counters" ADD CONSTRAINT "ai_usage_counters_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate the HNSW indexes dropped above by Prisma's drift detection (not representable in
-- schema.prisma, so every migration touching this schema re-drops them unless hand-restored here).
CREATE INDEX semantic_cache_entries_embedding_idx
  ON "semantic_cache_entries" USING hnsw (embedding vector_cosine_ops);

CREATE INDEX document_chunks_embedding_idx
  ON "document_chunks" USING hnsw (embedding vector_cosine_ops);

-- Row-Level Security (docs/06-database-design.md §2) — same pattern as every other tenant table.
ALTER TABLE "ai_usage_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_usage_counters" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ai_usage_counters"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "ai_usage_counters" TO enlace_app;
