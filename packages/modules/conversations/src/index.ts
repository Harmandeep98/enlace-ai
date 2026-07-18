// Public surface of the Conversations module (docs/04-folder-structure.md §2) —
// apps/api imports only from here, never reaching into domain/application/
// infrastructure internals directly.
export type {
  Conversation,
  ConversationStatus,
  EscalationReason,
  Message,
  MessageSender,
  ResolutionPath
} from "./domain/entities.js";
export { ConversationNotFoundError, ConversationNotOpenError, EscalationReasonRequiredError } from "./domain/errors.js";

export type {
  AppendMessageInput,
  ConversationRepository,
  FaqCachePort,
  SemanticCachePort,
  StartConversationInput
} from "./application/ports.js";
export { AddMessageUseCase } from "./application/add-message-use-case.js";
export type { AddMessageInput } from "./application/add-message-use-case.js";
export { EscalateConversationUseCase } from "./application/escalate-conversation-use-case.js";
export type { EscalateConversationInput } from "./application/escalate-conversation-use-case.js";
export { GetConversationUseCase } from "./application/get-conversation-use-case.js";
export type { GetConversationInput } from "./application/get-conversation-use-case.js";
export { IncomingMessageUseCase } from "./application/incoming-message-use-case.js";
export type { AddMessageWithReplyResult, StartConversationWithReplyResult } from "./application/incoming-message-use-case.js";
export { StartConversationUseCase } from "./application/start-conversation-use-case.js";
export type { StartConversationResult } from "./application/start-conversation-use-case.js";

export { PrismaConversationRepository } from "./infrastructure/prisma-conversation-repository.js";
