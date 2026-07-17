// docs/16-cost-optimization-strategy.md §2 — this is "Conversations' IncomingMessageUseCase",
// the pipeline's control-flow home. This slice only checks the FAQ-cache stage; later slices
// add semantic cache, retrieval, tool-calling, and model calls as further fallthrough steps.
//
// Only ever call addMessage() when the caller-supplied sender is "Customer" — an agent or the
// AI's own reply shouldn't be checked against the FAQ cache. The route layer (apps/api) enforces
// this branch; it is not re-checked here.
import type { AddMessageInput } from "./add-message-use-case.js";
import { AddMessageUseCase } from "./add-message-use-case.js";
import { StartConversationUseCase } from "./start-conversation-use-case.js";
import type { StartConversationResult } from "./start-conversation-use-case.js";
import type { Message } from "../domain/entities.js";
import type { ConversationRepository, FaqCachePort, StartConversationInput } from "./ports.js";

export interface StartConversationWithReplyResult extends StartConversationResult {
  aiReply: Message | null;
}

export interface AddMessageWithReplyResult {
  message: Message;
  aiReply: Message | null;
}

export class IncomingMessageUseCase {
  constructor(
    private readonly startConversationUseCase: StartConversationUseCase,
    private readonly addMessageUseCase: AddMessageUseCase,
    private readonly conversations: ConversationRepository,
    private readonly faqCache: FaqCachePort
  ) {}

  async startConversation(input: StartConversationInput): Promise<StartConversationWithReplyResult> {
    const result = await this.startConversationUseCase.execute(input);
    const aiReply = await this.checkFaqCacheAndReply(result.conversation.id, input.workspaceId, input.message);
    return { ...result, aiReply };
  }

  async addMessage(input: AddMessageInput): Promise<AddMessageWithReplyResult> {
    const message = await this.addMessageUseCase.execute(input);
    const aiReply = await this.checkFaqCacheAndReply(input.conversationId, input.workspaceId, input.content);
    return { message, aiReply };
  }

  private async checkFaqCacheAndReply(conversationId: string, workspaceId: string, content: string): Promise<Message | null> {
    const match = await this.faqCache.findBestMatch(workspaceId, content);
    if (!match) return null;

    return this.conversations.appendMessage({
      conversationId,
      workspaceId,
      sender: "AI",
      content: match.answer,
      resolutionPath: "FaqCache"
    });
  }
}
