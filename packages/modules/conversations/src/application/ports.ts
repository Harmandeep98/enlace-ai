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
  listMessages(conversationId: string, workspaceId: string, limit: number): Promise<Message[]>;
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

// Same consumer-defined structural-port pattern as FaqCachePort — Conversations has no
// dependency on @enlace/knowledge; PrismaSemanticCacheRepository satisfies this structurally,
// wired only at the composition root.
export interface SemanticCachePort {
  findBestMatch(workspaceId: string, message: string): Promise<{ answer: string } | undefined>;
  save(workspaceId: string, question: string, answer: string): Promise<void>;
}

// Consumer-defined structural port, same pattern as FaqCachePort/SemanticCachePort — Conversations
// has no dependency on @enlace/knowledge; PrismaDocumentChunkRepository satisfies this
// structurally, wired only at the composition root.
export interface RetrievalPort {
  findBestMatches(workspaceId: string, message: string, k: number): Promise<{ content: string }[]>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolExchangeTurn {
  toolCalls: ToolCall[];
  results: { id: string; content: string }[];
}

// Consumer-defined structural port — Conversations has no dependency on @enlace/ai-gateway;
// GoogleCompletionAdapter satisfies this structurally (its real CompletionResult has more
// fields than {content: string}, but that's fine — a wider return type is always assignable
// to a narrower one this consumer actually needs).
export interface CompletionPort {
  complete(request: {
    workspaceId: string;
    messages: { role: "user" | "assistant"; content: string }[];
    context: { content: string }[];
    tier: "small" | "large";
    tools?: { name: string; description: string; parameters: Record<string, unknown> }[];
    priorToolExchanges?: ToolExchangeTurn[];
  }): Promise<{ content: string; confidence: { score: number }; toolCalls?: ToolCall[] }>;
}

// Consumer-defined structural port, same pattern as FaqCachePort/CompletionPort — Conversations
// has no dependency on @enlace/notifications; SmtpEscalationNotifierAdapter satisfies this
// structurally, wired only at the composition root.
export interface EscalationNotifierPort {
  notify(input: { workspaceId: string; conversationId: string; reason: EscalationReason }): Promise<void>;
}

// Consumer-defined structural port — Conversations has no dependency on @enlace/integrations;
// InvokeToolUseCase satisfies this structurally, wired only at the composition root.
export interface ToolInvokerPort {
  listToolSchemas(workspaceId: string): Promise<{ name: string; description: string; parameters: Record<string, unknown> }[]>;
  invoke(toolName: string, args: Record<string, unknown>, workspaceId: string, conversationId: string): Promise<{ content: string }>;
}
