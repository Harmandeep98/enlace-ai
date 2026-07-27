// A deliberately separate use case from IncomingMessageUseCase, not a modified version of it
// (docs/superpowers/specs/2026-07-27-widget-public-api-design.md §2/§3) — widget conversations
// stream via completeStream() and never get tool-calling; dashboard conversations keep the full
// tool-calling + real-confidence pipeline in IncomingMessageUseCase, untouched by this file.
import { EscalateConversationUseCase } from "./escalate-conversation-use-case.js";
import type { Message } from "../domain/entities.js";
import type { CompletionPort, ConversationRepository, FaqCachePort, RetrievalPort, SemanticCachePort } from "./ports.js";

const MESSAGE_HISTORY_WINDOW = 10;
const RETRIEVAL_K = 5;
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const ESCALATION_REPLY = "I'm connecting you with a member of our team who can help.";
const FALLBACK_REPLY = "We're having trouble connecting — try again shortly.";

export type WidgetReplyEvent = { type: "chunk"; delta: string } | { type: "done"; message: Message };

function toConversationMessage(message: Message): { role: "user" | "assistant"; content: string } {
  return { role: message.sender === "Customer" ? "user" : "assistant", content: message.content };
}

export class IncomingWidgetMessageUseCase {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly faqCache: FaqCachePort,
    private readonly semanticCache: SemanticCachePort,
    private readonly retrieval: RetrievalPort,
    private readonly completion: CompletionPort,
    private readonly escalateConversationUseCase: EscalateConversationUseCase
  ) {}

  async *streamReply(conversationId: string, workspaceId: string, content: string): AsyncGenerator<WidgetReplyEvent> {
    const faqMatch = await this.faqCache.findBestMatch(workspaceId, content);
    if (faqMatch) {
      await this.semanticCache.save(workspaceId, content, faqMatch.answer);
      const message = await this.conversations.appendMessage({
        conversationId,
        workspaceId,
        sender: "AI",
        content: faqMatch.answer,
        resolutionPath: "FaqCache"
      });
      yield { type: "done", message };
      return;
    }

    const semanticMatch = await this.semanticCache.findBestMatch(workspaceId, content);
    if (semanticMatch) {
      const message = await this.conversations.appendMessage({
        conversationId,
        workspaceId,
        sender: "AI",
        content: semanticMatch.answer,
        resolutionPath: "SemanticCache"
      });
      yield { type: "done", message };
      return;
    }

    const history = await this.conversations.listMessages(conversationId, workspaceId, MESSAGE_HISTORY_WINDOW);
    const chunks = await this.retrieval.findBestMatches(workspaceId, content, RETRIEVAL_K);
    const messages = history.map(toConversationMessage);

    let finalResult: { content: string; confidence: { score: number } } | undefined;
    try {
      for await (const piece of this.completion.completeStream({ workspaceId, messages, context: chunks, tier: "small" })) {
        if (!piece.done) {
          yield { type: "chunk", delta: piece.contentDelta };
        } else {
          finalResult = piece.result;
        }
      }
    } catch {
      const message = await this.conversations.appendMessage({
        conversationId,
        workspaceId,
        sender: "AI",
        content: FALLBACK_REPLY,
        resolutionPath: null
      });
      yield { type: "done", message };
      return;
    }

    if (!finalResult || finalResult.confidence.score < LOW_CONFIDENCE_THRESHOLD) {
      await this.escalateConversationUseCase.execute({ conversationId, workspaceId, reason: "LowConfidence" });
      const message = await this.conversations.appendMessage({
        conversationId,
        workspaceId,
        sender: "AI",
        content: ESCALATION_REPLY,
        resolutionPath: "Escalated"
      });
      yield { type: "done", message };
      return;
    }

    const message = await this.conversations.appendMessage({
      conversationId,
      workspaceId,
      sender: "AI",
      content: finalResult.content,
      resolutionPath: "Retrieval"
    });
    yield { type: "done", message };
  }
}
