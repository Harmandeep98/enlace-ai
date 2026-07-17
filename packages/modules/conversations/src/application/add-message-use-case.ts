import { assertCanAddCustomerMessage } from "../domain/invariants.js";
import { ConversationNotFoundError } from "../domain/errors.js";
import type { Message } from "../domain/entities.js";
import type { ConversationRepository } from "./ports.js";

export interface AddMessageInput {
  conversationId: string;
  workspaceId: string;
  sender: Message["sender"];
  content: string;
}

export class AddMessageUseCase {
  constructor(private readonly conversations: ConversationRepository) {}

  async execute(input: AddMessageInput): Promise<Message> {
    const conversation = await this.conversations.findById(input.conversationId, input.workspaceId);
    if (!conversation) throw new ConversationNotFoundError(input.conversationId);

    if (input.sender === "Customer") {
      assertCanAddCustomerMessage(conversation);
    }

    return this.conversations.appendMessage({
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
      sender: input.sender,
      content: input.content,
      resolutionPath: null
    });
  }
}
