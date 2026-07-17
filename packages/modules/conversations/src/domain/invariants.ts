import { ConversationNotOpenError, EscalationReasonRequiredError } from "./errors.js";
import type { Conversation, EscalationReason } from "./entities.js";

export function assertCanAddCustomerMessage(conversation: Conversation): void {
  if (conversation.status === "Resolved") {
    throw new ConversationNotOpenError(conversation.id);
  }
}

export function assertValidEscalation(reason: EscalationReason | undefined): asserts reason is EscalationReason {
  if (!reason) {
    throw new EscalationReasonRequiredError();
  }
}
