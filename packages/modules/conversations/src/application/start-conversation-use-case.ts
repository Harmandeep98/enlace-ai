import type { Conversation, Message } from "../domain/entities.js";
import type { ConversationRepository, StartConversationInput } from "./ports.js";

export interface StartConversationResult {
  conversation: Conversation;
  message: Message;
}

export class StartConversationUseCase {
  constructor(private readonly conversations: ConversationRepository) {}

  async execute(input: StartConversationInput): Promise<StartConversationResult> {
    return this.conversations.create(input);
  }
}
