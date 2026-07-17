-- CreateTable
CREATE TABLE "faq_entries" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faq_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_entries_workspaceId_idx" ON "faq_entries"("workspaceId");

-- AddForeignKey
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (docs/06-database-design.md §2) — same pattern as every other tenant table.
ALTER TABLE "faq_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faq_entries" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "faq_entries"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "faq_entries" TO enlace_app;
