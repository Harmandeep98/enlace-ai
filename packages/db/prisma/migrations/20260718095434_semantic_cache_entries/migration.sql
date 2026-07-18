-- CreateTable
CREATE TABLE "semantic_cache_entries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "semantic_cache_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "semantic_cache_entries_workspaceId_idx" ON "semantic_cache_entries"("workspaceId");

-- AddForeignKey
ALTER TABLE "semantic_cache_entries" ADD CONSTRAINT "semantic_cache_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Vector similarity index (docs/06-database-design.md §5) — HNSW isn't expressible via
-- Prisma's @@index, hand-appended same as document_chunks' index in the architecture doc.
CREATE INDEX semantic_cache_entries_embedding_idx
  ON "semantic_cache_entries" USING hnsw (embedding vector_cosine_ops);

-- Row-Level Security (docs/06-database-design.md §2) — same pattern as every other tenant table.
ALTER TABLE "semantic_cache_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "semantic_cache_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "semantic_cache_entries"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "semantic_cache_entries" TO enlace_app;
