import { describe, expect, it } from "vitest";
import type { Conversation, Message } from "../domain/entities.js";
import type {
  AppendMessageInput,
  CompletionPort,
  ConversationRepository,
  EscalationNotifierPort,
  FaqCachePort,
  RetrievalPort,
  SemanticCachePort,
  StartConversationInput,
  ToolCall,
  ToolExchangeTurn,
  ToolInvokerPort
} from "./ports.js";
import { AddMessageUseCase } from "./add-message-use-case.js";
import { StartConversationUseCase } from "./start-conversation-use-case.js";
import { EscalateConversationUseCase } from "./escalate-conversation-use-case.js";
import { IncomingMessageUseCase } from "./incoming-message-use-case.js";

let nextId = 1;

class FakeConversationRepository implements ConversationRepository {
  private conversations = new Map<string, Conversation>();
  private messagesByConversation = new Map<string, Message[]>();
  public appended: AppendMessageInput[] = [];
  public statusUpdates: { conversationId: string; workspaceId: string; status: Conversation["status"]; escalationReason: Conversation["escalationReason"] }[] = [];

  async create(input: StartConversationInput) {
    const conversation: Conversation = {
      id: `conversation-${nextId++}`,
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      customerRef: input.customerRef,
      status: "Open",
      escalationReason: null
    };
    this.conversations.set(conversation.id, conversation);
    const message: Message = {
      id: `message-${nextId++}`,
      conversationId: conversation.id,
      sender: "Customer",
      content: input.message,
      resolutionPath: null,
      createdAt: new Date(0)
    };
    this.messagesByConversation.set(conversation.id, [message]);
    return { conversation, message };
  }

  async findById(conversationId: string): Promise<Conversation | undefined> {
    return this.conversations.get(conversationId);
  }

  async appendMessage(input: AppendMessageInput): Promise<Message> {
    this.appended.push(input);
    const message: Message = {
      id: `message-${nextId++}`,
      conversationId: input.conversationId,
      sender: input.sender,
      content: input.content,
      resolutionPath: input.resolutionPath,
      createdAt: new Date(0)
    };
    const existing = this.messagesByConversation.get(input.conversationId) ?? [];
    this.messagesByConversation.set(input.conversationId, [...existing, message]);
    return message;
  }

  async updateStatus(
    conversationId: string,
    workspaceId: string,
    status: Conversation["status"],
    escalationReason: Conversation["escalationReason"] | undefined
  ): Promise<Conversation> {
    const resolvedReason = escalationReason ?? null;
    this.statusUpdates.push({ conversationId, workspaceId, status, escalationReason: resolvedReason });
    const existing = this.conversations.get(conversationId) as Conversation;
    const updated = { ...existing, status, escalationReason: resolvedReason };
    this.conversations.set(conversationId, updated);
    return updated;
  }

  async listMessages(conversationId: string, _workspaceId: string, limit: number): Promise<Message[]> {
    const messages = this.messagesByConversation.get(conversationId) ?? [];
    return messages.slice(-limit);
  }
}

class FakeFaqCachePort implements FaqCachePort {
  constructor(private readonly match: { answer: string } | undefined) {}

  async findBestMatch(): Promise<{ answer: string } | undefined> {
    return this.match;
  }
}

class FakeSemanticCachePort implements SemanticCachePort {
  public saved: { workspaceId: string; question: string; answer: string }[] = [];
  constructor(private readonly match: { answer: string } | undefined) {}

  async findBestMatch(): Promise<{ answer: string } | undefined> {
    return this.match;
  }

  async save(workspaceId: string, question: string, answer: string): Promise<void> {
    this.saved.push({ workspaceId, question, answer });
  }
}

class FakeRetrievalPort implements RetrievalPort {
  public calls: { workspaceId: string; message: string; k: number }[] = [];
  constructor(private readonly chunks: { content: string }[]) {}

  async findBestMatches(workspaceId: string, message: string, k: number): Promise<{ content: string }[]> {
    this.calls.push({ workspaceId, message, k });
    return this.chunks;
  }
}

type CompletionBehavior =
  | { kind: "answer"; content: string; confidence?: { score: number } }
  | { kind: "toolCall"; toolCalls: ToolCall[]; thenAnswer: string }
  | { kind: "alwaysToolCall"; toolCalls: ToolCall[] }
  | "throw";

class FakeCompletionPort implements CompletionPort {
  public calls: Parameters<CompletionPort["complete"]>[0][] = [];
  constructor(private readonly behavior: CompletionBehavior) {}

  async complete(request: Parameters<CompletionPort["complete"]>[0]): Promise<{ content: string; confidence: { score: number }; toolCalls?: ToolCall[] }> {
    this.calls.push(request);
    if (this.behavior === "throw") {
      throw new Error("completion failed");
    }
    if (this.behavior.kind === "alwaysToolCall") {
      return { content: "", confidence: { score: 1 }, toolCalls: this.behavior.toolCalls };
    }
    if (this.behavior.kind === "toolCall") {
      if (!request.priorToolExchanges || request.priorToolExchanges.length === 0) {
        return { content: "", confidence: { score: 1 }, toolCalls: this.behavior.toolCalls };
      }
      return { content: this.behavior.thenAnswer, confidence: { score: 0.9 } };
    }
    return { content: this.behavior.content, confidence: this.behavior.confidence ?? { score: 0.9 } };
  }
}

class FakeToolInvokerPort implements ToolInvokerPort {
  public invokeCalls: { toolName: string; args: Record<string, unknown>; workspaceId: string }[] = [];
  constructor(private readonly schemas: { name: string; description: string; parameters: Record<string, unknown> }[], private readonly result: { content: string }) {}

  async listToolSchemas(): Promise<{ name: string; description: string; parameters: Record<string, unknown> }[]> {
    return this.schemas;
  }

  async invoke(toolName: string, args: Record<string, unknown>, workspaceId: string): Promise<{ content: string }> {
    this.invokeCalls.push({ toolName, args, workspaceId });
    return this.result;
  }
}

class FakeEscalationNotifierPort implements EscalationNotifierPort {
  public calls: { workspaceId: string; conversationId: string; reason: Conversation["escalationReason"] }[] = [];

  async notify(input: { workspaceId: string; conversationId: string; reason: NonNullable<Conversation["escalationReason"]> }): Promise<void> {
    this.calls.push(input);
  }
}

function buildUseCase(options: {
  faqMatch?: { answer: string };
  semanticMatch?: { answer: string };
  retrievedChunks?: { content: string }[];
  completionBehavior?: CompletionBehavior;
  toolSchemas?: { name: string; description: string; parameters: Record<string, unknown> }[];
  toolResult?: { content: string };
}) {
  const conversations = new FakeConversationRepository();
  const startConversationUseCase = new StartConversationUseCase(conversations);
  const addMessageUseCase = new AddMessageUseCase(conversations);
  const faqCache = new FakeFaqCachePort(options.faqMatch);
  const semanticCache = new FakeSemanticCachePort(options.semanticMatch);
  const retrieval = new FakeRetrievalPort(options.retrievedChunks ?? []);
  const completion = new FakeCompletionPort(options.completionBehavior ?? { kind: "answer", content: "A composed answer." });
  const toolInvoker = new FakeToolInvokerPort(options.toolSchemas ?? [], options.toolResult ?? { content: "tool result" });
  const escalationNotifier = new FakeEscalationNotifierPort();
  const escalateConversationUseCase = new EscalateConversationUseCase(conversations, escalationNotifier);
  const useCase = new IncomingMessageUseCase(
    startConversationUseCase,
    addMessageUseCase,
    conversations,
    faqCache,
    semanticCache,
    retrieval,
    completion,
    escalateConversationUseCase,
    toolInvoker
  );
  return { useCase, conversations, semanticCache, retrieval, completion, escalationNotifier, toolInvoker };
}

describe("IncomingMessageUseCase", () => {
  describe("startConversation", () => {
    it("appends an AI reply with resolutionPath FaqCache and writes it to the semantic cache", async () => {
      const { useCase, semanticCache } = buildUseCase({ faqMatch: { answer: "We're open 9am-5pm." } });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "What are your business hours?"
      });

      expect(result.aiReply?.content).toBe("We're open 9am-5pm.");
      expect(result.aiReply?.resolutionPath).toBe("FaqCache");
      expect(semanticCache.saved).toEqual([
        { workspaceId: "workspace-1", question: "What are your business hours?", answer: "We're open 9am-5pm." }
      ]);
    });

    it("appends an AI reply with resolutionPath SemanticCache when only the semantic cache matches", async () => {
      const { useCase, semanticCache } = buildUseCase({ semanticMatch: { answer: "We're open 9am-5pm." } });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "When do you open?"
      });

      expect(result.aiReply?.content).toBe("We're open 9am-5pm.");
      expect(result.aiReply?.resolutionPath).toBe("SemanticCache");
      expect(semanticCache.saved).toEqual([]);
    });

    it("falls through to retrieval + completion when neither cache matches, and appends with resolutionPath Retrieval", async () => {
      const { useCase, retrieval, completion } = buildUseCase({
        retrievedChunks: [{ content: "Our business hours are 9am to 5pm." }],
        completionBehavior: { kind: "answer", content: "We're open 9am to 5pm." }
      });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "What are your business hours?"
      });

      expect(result.aiReply?.content).toBe("We're open 9am to 5pm.");
      expect(result.aiReply?.resolutionPath).toBe("Retrieval");
      expect(retrieval.calls).toEqual([{ workspaceId: "workspace-1", message: "What are your business hours?", k: 3 }]);
      expect(completion.calls[0]?.context).toEqual([{ content: "Our business hours are 9am to 5pm." }]);
      expect(completion.calls[0]?.tier).toBe("small");
      expect(completion.calls[0]?.messages).toEqual([{ role: "user", content: "What are your business hours?" }]);
    });

    it("still calls completion with an empty context array when retrieval finds nothing", async () => {
      const { useCase, completion } = buildUseCase({ retrievedChunks: [] });

      await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "Something totally uncovered by the knowledge base"
      });

      expect(completion.calls[0]?.context).toEqual([]);
    });

    it("returns aiReply: null when completion throws", async () => {
      const { useCase } = buildUseCase({ completionBehavior: "throw" });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "Something that will fail"
      });

      expect(result.aiReply).toBeNull();
    });

    it("escalates and sends a placeholder reply when completion confidence is low", async () => {
      const { useCase, conversations, escalationNotifier } = buildUseCase({
        completionBehavior: { kind: "answer", content: "A shaky guess.", confidence: { score: 0.2 } }
      });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "Something ambiguous"
      });

      expect(result.aiReply?.content).toBe("I'm connecting you with a member of our team who can help.");
      expect(result.aiReply?.resolutionPath).toBe("Escalated");
      expect(conversations.statusUpdates).toEqual([
        { conversationId: result.conversation.id, workspaceId: "workspace-1", status: "Escalated", escalationReason: "LowConfidence" }
      ]);
      expect(escalationNotifier.calls).toEqual([
        { workspaceId: "workspace-1", conversationId: result.conversation.id, reason: "LowConfidence" }
      ]);
    });

    it("invokes a tool when the completion requests one, then answers using the tool's result", async () => {
      const toolCall = { id: "call-1", name: "get_order_status", args: { orderId: "12345" } };
      const { useCase, toolInvoker, completion } = buildUseCase({
        toolSchemas: [{ name: "get_order_status", description: "desc", parameters: {} }],
        toolResult: { content: "Your order shipped yesterday." },
        completionBehavior: { kind: "toolCall", toolCalls: [toolCall], thenAnswer: "Your order shipped yesterday." }
      });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "What's the status of order 12345?"
      });

      expect(toolInvoker.invokeCalls).toEqual([{ toolName: "get_order_status", args: { orderId: "12345" }, workspaceId: "workspace-1" }]);
      expect(result.aiReply?.content).toBe("Your order shipped yesterday.");
      expect(result.aiReply?.resolutionPath).toBe("Retrieval");
      expect(completion.calls[1]?.priorToolExchanges).toEqual([{ toolCalls: [toolCall], results: [{ id: "call-1", content: "Your order shipped yesterday." }] }]);
    });

    it("escalates with reason ToolFailure when the tool-call round cap is exceeded", async () => {
      const toolCall = { id: "call-1", name: "get_order_status", args: {} };
      const { useCase, conversations } = buildUseCase({
        toolSchemas: [{ name: "get_order_status", description: "desc", parameters: {} }],
        completionBehavior: { kind: "alwaysToolCall", toolCalls: [toolCall] }
      });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "What's the status of order 12345?"
      });

      expect(result.aiReply?.resolutionPath).toBe("Escalated");
      expect(conversations.statusUpdates).toEqual([
        { conversationId: result.conversation.id, workspaceId: "workspace-1", status: "Escalated", escalationReason: "ToolFailure" }
      ]);
    });
  });

  describe("addMessage", () => {
    it("appends an AI reply with resolutionPath SemanticCache for a matching follow-up", async () => {
      const { useCase, conversations } = buildUseCase({ semanticMatch: { answer: "Use the 'Forgot password' link." } });
      const { conversation } = await conversations.create({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "Hi"
      });

      const result = await useCase.addMessage({
        conversationId: conversation.id,
        workspaceId: "workspace-1",
        sender: "Customer",
        content: "How do I get back into my account?"
      });

      expect(result.aiReply?.content).toBe("Use the 'Forgot password' link.");
      expect(result.aiReply?.resolutionPath).toBe("SemanticCache");
    });

    it("falls through to retrieval + completion for a follow-up matching neither cache", async () => {
      const { useCase, conversations, completion } = buildUseCase({
        retrievedChunks: [{ content: "Refunds take 5-7 business days." }],
        completionBehavior: { kind: "answer", content: "Refunds take 5-7 business days to process." }
      });
      const { conversation } = await conversations.create({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "Hi"
      });

      const result = await useCase.addMessage({
        conversationId: conversation.id,
        workspaceId: "workspace-1",
        sender: "Customer",
        content: "How long do refunds take?"
      });

      expect(result.aiReply?.content).toBe("Refunds take 5-7 business days to process.");
      expect(result.aiReply?.resolutionPath).toBe("Retrieval");
      expect(completion.calls[0]?.messages).toEqual([
        { role: "user", content: "Hi" },
        { role: "user", content: "How long do refunds take?" }
      ]);
    });
  });
});
