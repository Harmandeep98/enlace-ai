import { DomainError } from "@enlace/shared";

// docs/05-domain-model.md §5: a Resolved conversation cannot receive a new customer
// message without transitioning back to Open first — no silent reopening.
export class ConversationNotOpenError extends DomainError {
  readonly code = "conversation_not_open";
  constructor(conversationId: string) {
    super(`Conversation "${conversationId}" is Resolved and cannot receive a new customer message without reopening first.`);
  }
}

// docs/05-domain-model.md §5: Escalated requires an EscalationReason — never escalate
// without recording why.
export class EscalationReasonRequiredError extends DomainError {
  readonly code = "escalation_reason_required";
  constructor() {
    super("An EscalationReason is required to escalate a conversation.");
  }
}

export class ConversationNotFoundError extends DomainError {
  readonly code = "conversation_not_found";
  constructor(conversationId: string) {
    super(`Conversation "${conversationId}" was not found.`);
  }
}
