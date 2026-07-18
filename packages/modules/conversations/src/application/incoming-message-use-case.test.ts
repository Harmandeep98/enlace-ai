import { describe, expect, it } from "vitest";
import type { Conversation, Message } from "../domain/entities.js";
import type {
  AppendMessageInput,
  ConversationRepository,
  FaqCachePort,
  SemanticCachePort,
  StartConversationInput
} from "./ports.js";
import { AddMessageUseCase } from "./add-message-use-case.js";
import { StartConversationUseCase } from "./start-conversation-use-case.js";
import { IncomingMessageUseCase } from "./incoming-message-use-case.js";

let nextId = 1;

class FakeConversationRepository implements ConversationRepository {
  private conversations = new Map<string, Conversation>();
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
    return { conversation, message };
  }

  async findById(conversationId: string): Promise<Conversation | undefined> {
    return this.conversations.get(conversationId);
  }

  async appendMessage(input: AppendMessageInput): Promise<Message> {
    this.appended.push(input);
    return {
      id: `message-${nextId++}`,
      conversationId: input.conversationId,
      sender: input.sender,
      content: input.content,
      resolutionPath: input.resolutionPath,
      createdAt: new Date(0)
    };
  }

  async updateStatus(): Promise<Conversation> {
    throw new Error("not used in this test");
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

function buildUseCase(
  faqMatch: { answer: string } | undefined,
  semanticMatch: { answer: string } | undefined = undefined
) {
  const conversations = new FakeConversationRepository();
  const startConversationUseCase = new StartConversationUseCase(conversations);
  const addMessageUseCase = new AddMessageUseCase(conversations);
  const faqCache = new FakeFaqCachePort(faqMatch);
  const semanticCache = new FakeSemanticCachePort(semanticMatch);
  const useCase = new IncomingMessageUseCase(
    startConversationUseCase,
    addMessageUseCase,
    conversations,
    faqCache,
    semanticCache
  );
  return { useCase, conversations, semanticCache };
}

describe("IncomingMessageUseCase", () => {
  describe("startConversation", () => {
    it("appends an AI reply with resolutionPath FaqCache and writes it to the semantic cache", async () => {
      const { useCase, semanticCache } = buildUseCase({ answer: "We're open 9am-5pm." });

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
      const { useCase, semanticCache } = buildUseCase(undefined, { answer: "We're open 9am-5pm." });

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

    it("returns aiReply: null when neither cache matches", async () => {
      const { useCase } = buildUseCase(undefined, undefined);

      const result = await useCase.startConversation({
        workspaceId: "workspace-1",
        channelId: "channel-1",
        customerRef: "customer-1",
        message: "Something with no match at all"
      });

      expect(result.aiReply).toBeNull();
    });
  });

  describe("addMessage", () => {
    it("appends an AI reply with resolutionPath SemanticCache for a matching follow-up", async () => {
      const { useCase, conversations } = buildUseCase(undefined, { answer: "Use the 'Forgot password' link." });
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

    it("returns aiReply: null when nothing matches", async () => {
      const { useCase, conversations } = buildUseCase(undefined, undefined);
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
        content: "Random unmatched question"
      });

      expect(result.aiReply).toBeNull();
    });
  });
});
