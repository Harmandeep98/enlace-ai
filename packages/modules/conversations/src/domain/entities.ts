// docs/05-domain-model.md §5 — domain-facing types, independent of the Prisma schema shape.
export type ConversationStatus = "Open" | "AIHandling" | "Escalated" | "Resolved";
export type MessageSender = "Customer" | "AI" | "Human";
export type EscalationReason = "LowConfidence" | "CustomerRequest" | "ToolFailure" | "PolicyTrigger";
export type ResolutionPath = "FaqCache" | "SemanticCache" | "Retrieval" | "ToolCall" | "SmallModel" | "LargeModel" | "Escalated";

export interface Conversation {
  id: string;
  workspaceId: string;
  channelId: string;
  customerRef: string;
  status: ConversationStatus;
  escalationReason: EscalationReason | null;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: MessageSender;
  content: string;
  resolutionPath: ResolutionPath | null;
  createdAt: Date;
}
