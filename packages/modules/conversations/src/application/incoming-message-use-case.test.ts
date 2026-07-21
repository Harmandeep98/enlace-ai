import { describe, expect, it } from "vitest";
import type { Conversation, Message } from "../domain/entities.js";
import type {
  AppendMessageInput,
  CompletionPort,
  ConversationRepository,
  FaqCachePort,
  RetrievalPort,
  SemanticCachePort,
  StartConversationInput
} from "./ports.js";
import { AddMessageUseCase } from "./add-message-use-case.js";
import { StartConversationUseCase } from "./start-conversation-use-case.js";
import { IncomingMessageUseCase } from "./incoming-message-use-case.js";

let nextId = 1;

class FakeConversationRepository implements ConversationRepository {
  private conversations = new Map<string, Conversation>();
  private messagesByConversation = new Map<string, Message[]>();
  public appended: AppendMessageInput[] = [];

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

  async updateStatus(): Promise<Conversation> {
    throw new Error("not used in this test");
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

class FakeCompletionPort implements CompletionPort {
  public calls: Parameters<CompletionPort["complete"]>[0][] = [];
  constructor(private readonly behavior: { content: string } | "throw") {}

  async complete(request: Parameters<CompletionPort["complete"]>[0]): Promise<{ content: string }> {
    this.calls.push(request);
    if (this.behavior === "throw") {
      throw new Error("completion failed");
    }
    return this.behavior;
  }
}

function buildUseCase(options: {
  faqMatch?: { answer: string };
  semanticMatch?: { answer: string };
  retrievedChunks?: { content: string }[];
  completionResult?: { content: string } | "throw";
}) {
  const conversations = new FakeConversationRepository();
  const startConversationUseCase = new StartConversationUseCase(conversations);
  const addMessageUseCase = new AddMessageUseCase(conversations);
  const faqCache = new FakeFaqCachePort(options.faqMatch);
  const semanticCache = new FakeSemanticCachePort(options.semanticMatch);
  const retrieval = new FakeRetrievalPort(options.retrievedChunks ?? []);
  const completion = new FakeCompletionPort(options.completionResult ?? { content: "A composed answer." });
  const useCase = new IncomingMessageUseCase(
    startConversationUseCase,
    addMessageUseCase,
    conversations,
    faqCache,
    semanticCache,
    retrieval,
    completion
  );
  return { useCase, conversations, semanticCache, retrieval, completion };
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
        completionResult: { content: "We're open 9am to 5pm." }
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
      const { useCase } = buildUseCase({ completionResult: "throw" });

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "Something that will fail"
      });

      expect(result.aiReply).toBeNull();
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
        completionResult: { content: "Refunds take 5-7 business days to process." }
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
      // History includes the conversation's opening "Hi" message plus this follow-up.
      expect(completion.calls[0]?.messages).toEqual([
        { role: "user", content: "Hi" },
        { role: "user", content: "How long do refunds take?" }
      ]);
    });
  });
});
