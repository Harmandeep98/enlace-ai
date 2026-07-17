-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('Widget');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('Open', 'AIHandling', 'Escalated', 'Resolved');

-- CreateEnum
CREATE TYPE "EscalationReason" AS ENUM ('LowConfidence', 'CustomerRequest', 'ToolFailure', 'PolicyTrigger');

-- CreateEnum
CREATE TYPE "MessageSender" AS ENUM ('Customer', 'AI', 'Human');

-- CreateEnum
CREATE TYPE "ResolutionPath" AS ENUM ('FaqCache', 'SemanticCache', 'Retrieval', 'ToolCall', 'SmallModel', 'LargeModel');

-- CreateTable
CREATE TABLE "channel_connections" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type" "ChannelType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "channel_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "customerRef" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'Open',
    "escalationReason" "EscalationReason",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sender" "MessageSender" NOT NULL,
    "content" TEXT NOT NULL,
    "resolutionPath" "ResolutionPath",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_connections_workspaceId_idx" ON "channel_connections"("workspaceId");

-- CreateIndex
CREATE INDEX "conversations_workspaceId_idx" ON "conversations"("workspaceId");

-- CreateIndex
CREATE INDEX "messages_workspaceId_idx" ON "messages"("workspaceId");

-- AddForeignKey
ALTER TABLE "channel_connections" ADD CONSTRAINT "channel_connections_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channel_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row-Level Security (docs/06-database-design.md §2) — same pattern as memberships:
-- workspaceId/ids are TEXT (Better Auth-compatible convention), compared as text.
ALTER TABLE "channel_connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "channel_connections" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "channel_connections"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "conversations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "conversations"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "messages"
  USING ("workspaceId" = current_setting('app.workspace_id', true));

GRANT SELECT, INSERT, UPDATE, DELETE ON "channel_connections", "conversations", "messages" TO enlace_app;
