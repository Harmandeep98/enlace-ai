// docs/16-cost-optimization-strategy.md §2 — this is "Conversations' IncomingMessageUseCase",
// the pipeline's control-flow home. FAQ cache is checked first (cheapest); a hit also writes
// the (question, answer) pair into the semantic cache. Semantic cache is checked second.
// Retrieval + completion is the 3rd stage: when neither cache matches, relevant knowledge
// chunks are retrieved and a real answer is composed via AI Gateway's completion capability
// (docs/superpowers/specs/2026-07-20-pipeline-retrieval-completion-design.md). When that
// completion comes back low-confidence, escalate instead of sending it
// (docs/superpowers/specs/2026-07-21-confidence-driven-escalation-design.md).
//
// Only ever call addMessage() when the caller-supplied sender is "Customer" — an agent or the
// AI's own reply shouldn't be checked against either cache. The route layer (apps/api) enforces
// this branch; it is not re-checked here.
import type { AddMessageInput } from "./add-message-use-case.js";
import { AddMessageUseCase } from "./add-message-use-case.js";
import { StartConversationUseCase } from "./start-conversation-use-case.js";
import type { StartConversationResult } from "./start-conversation-use-case.js";
import { EscalateConversationUseCase } from "./escalate-conversation-use-case.js";
import type { Message } from "../domain/entities.js";
import type {
  CompletionPort,
  ConversationRepository,
  FaqCachePort,
  RetrievalPort,
  SemanticCachePort,
  StartConversationInput
} from "./ports.js";

const MESSAGE_HISTORY_WINDOW = 10;
const RETRIEVAL_K = 3;
// Mirrors @enlace/ai-gateway's ESCALATION_CONFIDENCE_THRESHOLD (0.6) — duplicated here since
// Conversations must not import @enlace/ai-gateway directly (consumer-defined structural ports).
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const ESCALATION_REPLY = "I'm connecting you with a member of our team who can help.";

export interface StartConversationWithReplyResult extends StartConversationResult {
  aiReply: Message | null;
}

export interface AddMessageWithReplyResult {
  message: Message;
  aiReply: Message | null;
}

function toConversationMessage(message: Message): { role: "user" | "assistant"; content: string } {
  return { role: message.sender === "Customer" ? "user" : "assistant", content: message.content };
}

export class IncomingMessageUseCase {
  constructor(
    private readonly startConversationUseCase: StartConversationUseCase,
    private readonly addMessageUseCase: AddMessageUseCase,
    private readonly conversations: ConversationRepository,
    private readonly faqCache: FaqCachePort,
    private readonly semanticCache: SemanticCachePort,
    private readonly retrieval: RetrievalPort,
    private readonly completion: CompletionPort,
    private readonly escalateConversationUseCase: EscalateConversationUseCase
  ) {}

  async startConversation(input: StartConversationInput): Promise<StartConversationWithReplyResult> {
    const result = await this.startConversationUseCase.execute(input);
    const aiReply = await this.checkCachesAndReply(result.conversation.id, input.workspaceId, input.message);
    return { ...result, aiReply };
  }

  async addMessage(input: AddMessageInput): Promise<AddMessageWithReplyResult> {
    const message = await this.addMessageUseCase.execute(input);
    const aiReply = await this.checkCachesAndReply(input.conversationId, input.workspaceId, input.content);
    return { message, aiReply };
  }

  private async checkCachesAndReply(conversationId: string, workspaceId: string, content: string): Promise<Message | null> {
    const faqMatch = await this.faqCache.findBestMatch(workspaceId, content);
    if (faqMatch) {
      await this.semanticCache.save(workspaceId, content, faqMatch.answer);
      return this.conversations.appendMessage({
        conversationId,
        workspaceId,
        sender: "AI",
        content: faqMatch.answer,
        resolutionPath: "FaqCache"
      });
    }

    const semanticMatch = await this.semanticCache.findBestMatch(workspaceId, content);
    if (semanticMatch) {
      return this.conversations.appendMessage({
        conversationId,
        workspaceId,
        sender: "AI",
        content: semanticMatch.answer,
        resolutionPath: "SemanticCache"
      });
    }

    return this.retrieveAndComplete(conversationId, workspaceId, content);
  }

  // By the time this runs, the current customer message is already persisted (via
  // StartConversationUseCase/AddMessageUseCase, both called before checkCachesAndReply) — so
  // listMessages already includes it as the last entry. Don't append it again.
  private async retrieveAndComplete(conversationId: string, workspaceId: string, content: string): Promise<Message | null> {
    const history = await this.conversations.listMessages(conversationId, workspaceId, MESSAGE_HISTORY_WINDOW);
    const chunks = await this.retrieval.findBestMatches(workspaceId, content, RETRIEVAL_K);

    let result: { content: string; confidence: { score: number } };
    try {
      result = await this.completion.complete({
        workspaceId,
        messages: history.map(toConversationMessage),
        context: chunks,
        tier: "small"
      });
    } catch {
      return null;
    }

    if (result.confidence.score < LOW_CONFIDENCE_THRESHOLD) {
      await this.escalateConversationUseCase.execute({ conversationId, workspaceId, reason: "LowConfidence" });
      return this.conversations.appendMessage({
        conversationId,
        workspaceId,
        sender: "AI",
        content: ESCALATION_REPLY,
        resolutionPath: "Escalated"
      });
    }

    return this.conversations.appendMessage({
      conversationId,
      workspaceId,
      sender: "AI",
      content: result.content,
      resolutionPath: "Retrieval"
    });
  }
}
