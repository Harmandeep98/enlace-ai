-- DropIndex
DROP INDEX "integration_connections_workspaceId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_workspaceId_type_key" ON "integration_connections"("workspaceId", "type");
