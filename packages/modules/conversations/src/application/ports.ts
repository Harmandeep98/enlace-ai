import type { Conversation, EscalationReason, Message, MessageSender, ResolutionPath } from "../domain/entities.js";

export interface StartConversationInput {
  workspaceId: string;
  channelId: string;
  customerRef: string;
  message: string;
}

export interface AppendMessageInput {
  conversationId: string;
  workspaceId: string;
  sender: MessageSender;
  content: string;
  resolutionPath: ResolutionPath | null;
}

export interface ConversationRepository {
  create(input: StartConversationInput): Promise<{ conversation: Conversation; message: Message }>;
  findById(conversationId: string, workspaceId: string): Promise<Conversation | undefined>;
  appendMessage(input: AppendMessageInput): Promise<Message>;
  updateStatus(
    conversationId: string,
    workspaceId: string,
    status: Conversation["status"],
    escalationReason: EscalationReason | undefined
  ): Promise<Conversation>;
}

// Conversations only needs "does this message match a cached answer" — it does not need
// Knowledge's own FaqEntry type, so this port is intentionally minimal and Conversations has
// no dependency on @enlace/knowledge. The composition root is the only place that knows
// PrismaFaqRepository satisfies this port structurally (same pattern as ChannelProvisioningPort
// in @enlace/identity).
export interface FaqCachePort {
  findBestMatch(workspaceId: string, message: string): Promise<{ answer: string } | undefined>;
}
