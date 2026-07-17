import { Prisma, prisma } from "@enlace/db";
import type { Conversation, EscalationReason, Message } from "../domain/entities.js";
import type { AppendMessageInput, ConversationRepository, StartConversationInput } from "../application/ports.js";

function toConversation(row: {
  id: string;
  workspaceId: string;
  channelId: string;
  customerRef: string;
  status: Conversation["status"];
  escalationReason: EscalationReason | null;
}): Conversation {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    channelId: row.channelId,
    customerRef: row.customerRef,
    status: row.status,
    escalationReason: row.escalationReason
  };
}

function toMessage(row: {
  id: string;
  conversationId: string;
  sender: Message["sender"];
  content: string;
  resolutionPath: Message["resolutionPath"];
  createdAt: Date;
}): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    sender: row.sender,
    content: row.content,
    resolutionPath: row.resolutionPath,
    createdAt: row.createdAt
  };
}

export class PrismaConversationRepository implements ConversationRepository {
  // Every method scopes its own transaction to the given workspace (docs/06-database-design.md
  // §2) — there's no session-scoped tenant middleware yet (this slice passes workspaceId
  // explicitly per the design spec §3), and Prisma doesn't guarantee a SET session variable
  // survives across pooled-connection calls, so each operation sets it itself.
  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  async create(input: StartConversationInput): Promise<{ conversation: Conversation; message: Message }> {
    const { conversationRow, messageRow } = await this.withTenant(input.workspaceId, async (tx) => {
      const conversationRow = await tx.conversation.create({
        data: { workspaceId: input.workspaceId, channelId: input.channelId, customerRef: input.customerRef }
      });
      const messageRow = await tx.message.create({
        data: { conversationId: conversationRow.id, workspaceId: input.workspaceId, sender: "Customer", content: input.message }
      });
      return { conversationRow, messageRow };
    });
    return { conversation: toConversation(conversationRow), message: toMessage(messageRow) };
  }

  // Deliberately not fetching messages here (docs/05-domain-model.md §5's aggregate-boundary
  // note) — a single conversation lookup never needs its full message history.
  async findById(conversationId: string, workspaceId: string): Promise<Conversation | undefined> {
    const row = await this.withTenant(workspaceId, (tx) => tx.conversation.findFirst({ where: { id: conversationId } }));
    if (!row) return undefined;
    return toConversation(row);
  }

  async appendMessage(input: AppendMessageInput): Promise<Message> {
    const row = await this.withTenant(input.workspaceId, (tx) =>
      tx.message.create({
        data: {
          conversationId: input.conversationId,
          workspaceId: input.workspaceId,
          sender: input.sender,
          content: input.content,
          resolutionPath: input.resolutionPath ?? undefined
        }
      })
    );
    return toMessage(row);
  }

  async updateStatus(
    conversationId: string,
    workspaceId: string,
    status: Conversation["status"],
    escalationReason: EscalationReason | undefined
  ): Promise<Conversation> {
    const row = await this.withTenant(workspaceId, (tx) =>
      tx.conversation.update({ where: { id: conversationId }, data: { status, escalationReason: escalationReason ?? null } })
    );
    return toConversation(row);
  }
}
