import { assertValidEscalation } from "../domain/invariants.js";
import { ConversationNotFoundError } from "../domain/errors.js";
import type { Conversation, EscalationReason } from "../domain/entities.js";
import type { ConversationRepository } from "./ports.js";

export interface EscalateConversationInput {
  conversationId: string;
  workspaceId: string;
  reason: EscalationReason | undefined;
}

export class EscalateConversationUseCase {
  constructor(private readonly conversations: ConversationRepository) {}

  async execute(input: EscalateConversationInput): Promise<Conversation> {
    const conversation = await this.conversations.findById(input.conversationId, input.workspaceId);
    if (!conversation) throw new ConversationNotFoundError(input.conversationId);

    assertValidEscalation(input.reason);

    return this.conversations.updateStatus(input.conversationId, input.workspaceId, "Escalated", input.reason);
  }
}
