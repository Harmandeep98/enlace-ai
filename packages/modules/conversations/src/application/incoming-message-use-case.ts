// docs/16-cost-optimization-strategy.md §2 — this is "Conversations' IncomingMessageUseCase",
// the pipeline's control-flow home. FAQ cache is checked first (cheapest); a hit also writes
// the (question, answer) pair into the semantic cache. Semantic cache is checked second.
// Retrieval + completion is the 3rd stage: when neither cache matches, relevant knowledge
// chunks are retrieved and a real answer is composed via AI Gateway's completion capability
// (docs/superpowers/specs/2026-07-20-pipeline-retrieval-completion-design.md). When that
// completion comes back low-confidence, escalate instead of sending it
// (docs/superpowers/specs/2026-07-21-confidence-driven-escalation-design.md). When it requests
// a tool instead of answering, invoke it and feed the result back, bounded by
// MAX_TOOL_CALL_ROUNDS (docs/superpowers/specs/2026-07-21-tool-calling-integrations-design.md).
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
  StartConversationInput,
  ToolExchangeTurn,
  ToolInvokerPort
} from "./ports.js";

const MESSAGE_HISTORY_WINDOW = 10;
const RETRIEVAL_K = 3;
// Mirrors @enlace/ai-gateway's ESCALATION_CONFIDENCE_THRESHOLD (0.6) — duplicated here since
// Conversations must not import @enlace/ai-gateway directly (consumer-defined structural ports).
const LOW_CONFIDENCE_THRESHOLD = 0.6;
const MAX_TOOL_CALL_ROUNDS = 3;
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
    private readonly escalateConversationUseCase: EscalateConversationUseCase,
    private readonly toolInvoker: ToolInvokerPort
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
    const messages = history.map(toConversationMessage);
    const tools = await this.toolInvoker.listToolSchemas(workspaceId);

    const priorToolExchanges: ToolExchangeTurn[] = [];

    for (let round = 0; round <= MAX_TOOL_CALL_ROUNDS; round++) {
      let result;
      try {
        result = await this.completion.complete({
          workspaceId,
          messages,
          context: chunks,
          tier: "small",
          tools: tools.length > 0 ? tools : undefined,
          priorToolExchanges: priorToolExchanges.length > 0 ? priorToolExchanges : undefined
        });
      } catch {
        return null;
      }

      // A tool-call round is never a final answer — its confidence field is a meaningless
      // placeholder. Check toolCalls before ever looking at confidence.
      if (result.toolCalls && result.toolCalls.length > 0) {
        if (round === MAX_TOOL_CALL_ROUNDS) {
          await this.escalateConversationUseCase.execute({ conversationId, workspaceId, reason: "ToolFailure" });
          return this.conversations.appendMessage({
            conversationId,
            workspaceId,
            sender: "AI",
            content: ESCALATION_REPLY,
            resolutionPath: "Escalated"
          });
        }

        const results = await Promise.all(
          result.toolCalls.map(async (toolCall) => {
            try {
              const toolResult = await this.toolInvoker.invoke(toolCall.name, toolCall.args, workspaceId);
              return { id: toolCall.id, content: toolResult.content };
            } catch (error) {
              return { id: toolCall.id, content: `Error: ${error instanceof Error ? error.message : "tool invocation failed"}` };
            }
          })
        );
        priorToolExchanges.push({ toolCalls: result.toolCalls, results });
        continue;
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

    return null;
  }
}
