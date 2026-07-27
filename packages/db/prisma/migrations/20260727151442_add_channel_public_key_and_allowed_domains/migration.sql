-- AlterTable
ALTER TABLE "channel_connections" ADD COLUMN     "allowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "channel_connections" ADD COLUMN     "publicKey" TEXT NOT NULL DEFAULT ('wk_live_' || replace(gen_random_uuid()::text, '-', ''));

-- CreateIndex
CREATE UNIQUE INDEX "channel_connections_publicKey_key" ON "channel_connections"("publicKey");

-- Widens channel_connections' RLS policy to also allow lookup by publicKey without already
-- knowing the workspace — needed to resolve "which workspace does this widget key belong to"
-- (same chicken-and-egg problem, same fix, as the earlier memberships RLS widening).
DROP POLICY tenant_isolation ON "channel_connections";
CREATE POLICY tenant_isolation ON "channel_connections"
  USING (
    "workspaceId" = current_setting('app.workspace_id', true)
    OR "publicKey" = current_setting('app.public_key', true)
  );
