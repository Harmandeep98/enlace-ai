import { PrismaIntegrationConnectionRepository, ZendeskAdapter } from "@enlace/integrations";
import { PrismaConversationRepository } from "@enlace/conversations";

const integrationConnections = new PrismaIntegrationConnectionRepository();
const conversations = new PrismaConversationRepository();
const zendeskAdapter = new ZendeskAdapter();

// The Zendesk connection this reconciles is looked up fresh each run rather than passed by id —
// findByWorkspaceAndType now returns at most one Zendesk connection per workspace (the schema's
// (workspaceId, type) uniqueness constraint), so workspaceId alone is a sufficient, stable
// lookup key across the life of the schedule even if the connection were ever recreated.
export async function syncZendeskTickets(workspaceId: string): Promise<void> {
  const connection = await integrationConnections.findByWorkspaceAndType(workspaceId, "Zendesk");
  if (!connection || connection.status !== "Active") return;

  const credential = await integrationConnections.getDecryptedCredential(connection.id, workspaceId);
  const { resolvedConversationRefs } = await zendeskAdapter.sync(connection.config, credential);

  for (const conversationId of resolvedConversationRefs) {
    await conversations.updateStatus(conversationId, workspaceId, "Resolved", undefined);
  }
}
