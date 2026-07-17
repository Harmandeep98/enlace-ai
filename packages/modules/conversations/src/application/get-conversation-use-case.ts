import { ConversationNotFoundError } from "../domain/errors.js";
import type { Conversation } from "../domain/entities.js";
import type { ConversationRepository } from "./ports.js";

export interface GetConversationInput {
  conversationId: string;
  workspaceId: string;
}

export class GetConversationUseCase {
  constructor(private readonly conversations: ConversationRepository) {}

  async execute(input: GetConversationInput): Promise<Conversation> {
    const conversation = await this.conversations.findById(input.conversationId, input.workspaceId);
    if (!conversation) throw new ConversationNotFoundError(input.conversationId);
    return conversation;
  }
}
