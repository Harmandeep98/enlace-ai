export type ConversationStatus = "Open" | "AIHandling" | "Escalated" | "Resolved";
export type MessageSender = "Customer" | "AI" | "Human";
export type EscalationReason = "LowConfidence" | "CustomerRequest" | "ToolFailure" | "PolicyTrigger";
export type ResolutionPath = "FaqCache" | "SemanticCache" | "Retrieval" | "ToolCall" | "SmallModel" | "LargeModel" | "Escalated";

// createdAt/updatedAt are ISO date strings here, not Date — this type describes the
// JSON the API actually returns over the wire, not the backend's domain type.
export interface Conversation {
  id: string;
  workspaceId: string;
  channelId: string;
  customerRef: string;
  status: ConversationStatus;
  escalationReason: EscalationReason | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  sender: MessageSender;
  content: string;
  resolutionPath: ResolutionPath | null;
  createdAt: string;
}

export type ConversationEvent =
  | { type: "message"; conversationId: string; message: Message }
  | { type: "status"; conversationId: string; conversation: Conversation };

export type KnowledgeSourceType = "Website" | "Pdf" | "Docx" | "Markdown" | "Txt" | "Faq";
export type KnowledgeSyncStatus = "Pending" | "Processing" | "Ready" | "Failed";

export interface KnowledgeSource {
  id: string;
  workspaceId: string;
  type: KnowledgeSourceType;
  origin: string;
  syncStatus: KnowledgeSyncStatus;
  lastSyncedAt: string | null;
}

export interface FaqEntry {
  id: string;
  workspaceId: string;
  question: string;
  answer: string;
}
