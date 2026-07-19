-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('Google', 'OpenAI', 'Anthropic', 'OpenRouter', 'Ollama');

-- CreateEnum
CREATE TYPE "KeyMode" AS ENUM ('Platform', 'BringYourOwn');

-- CreateEnum
CREATE TYPE "ProviderConfigStatus" AS ENUM ('Active', 'Disabled');

-- DropIndex
DROP INDEX "document_chunks_embedding_idx";

-- DropIndex
DROP INDEX "semantic_cache_entries_embedding_idx";

-- CreateTable
CREATE TABLE "provider_configs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "Provider" NOT NULL,
    "keyMode" "KeyMode" NOT NULL,
    "encryptedApiKey" TEXT,
    "status" "ProviderConfigStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "provider_configs_workspaceId_idx" ON "provider_configs"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "provider_configs_workspaceId_provider_key" ON "provider_configs"("workspaceId", "provider");

-- AddForeignKey
ALTER TABLE "provider_configs" ADD CONSTRAINT "provider_configs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Recreate the HNSW indexes dropped above by Prisma's drift detection (not representable in
-- schema.prisma, so every migration touching this area re-drops them unless hand-restored here).
CREATE INDEX semantic_cache_entries_embedding_idx
  ON "semantic_cache_entries" USING hnsw (embedding vector_cosine_ops);

CREATE INDEX document_chunks_embedding_idx
  ON "document_chunks" USING hnsw (embedding vector_cosine_ops);

-- Row-Level Security (docs/06-database-design.md §2) — same pattern as every other tenant table.
ALTER TABLE "provider_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "provider_configs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "provider_configs"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "provider_configs" TO enlace_app;
