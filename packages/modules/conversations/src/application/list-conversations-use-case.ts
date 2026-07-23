import type { Conversation, ConversationStatus } from "../domain/entities.js";
import type { ConversationRepository } from "./ports.js";

export interface ListConversationsInput {
  workspaceId: string;
  status?: ConversationStatus;
}

export class ListConversationsUseCase {
  constructor(private readonly conversations: ConversationRepository) {}

  async execute(input: ListConversationsInput): Promise<Conversation[]> {
    return this.conversations.listConversations(input.workspaceId, input.status);
  }
}
