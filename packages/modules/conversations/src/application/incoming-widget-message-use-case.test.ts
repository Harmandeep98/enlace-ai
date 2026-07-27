import { describe, expect, it } from "vitest";
import type { Conversation, Message } from "../domain/entities.js";
import type {
  AppendMessageInput,
  ConversationRepository,
  EscalationNotifierPort,
  FaqCachePort,
  RetrievalPort,
  SemanticCachePort
} from "./ports.js";
import { EscalateConversationUseCase } from "./escalate-conversation-use-case.js";
import { IncomingWidgetMessageUseCase } from "./incoming-widget-message-use-case.js";

let nextMessageId = 1;

class FakeConversationRepository implements ConversationRepository {
  public appended: AppendMessageInput[] = [];
  async create(): Promise<{ conversation: Conversation; message: Message }> {
    throw new Error("not used in this test");
  }
  async findById(conversationId: string, workspaceId: string): Promise<Conversation | undefined> {
    return {
      id: conversationId,
      workspaceId,
      channelId: "channel-1",
      customerRef: "visitor-1",
      status: "AIHandling",
      escalationReason: null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
  async listConversations(): Promise<Conversation[]> {
    throw new Error("not used in this test");
  }
  async appendMessage(input: AppendMessageInput): Promise<Message> {
    this.appended.push(input);
    return {
      id: `message-${nextMessageId++}`,
      conversationId: input.conversationId,
      sender: input.sender,
      content: input.content,
      resolutionPath: input.resolutionPath,
      createdAt: new Date()
    };
  }
  async listMessages(): Promise<Message[]> {
    return [];
  }
  async updateStatus(conversationId: string, workspaceId: string, status: Conversation["status"], escalationReason: Conversation["escalationReason"] | undefined): Promise<Conversation> {
    return {
      id: conversationId,
      workspaceId,
      channelId: "channel-1",
      customerRef: "visitor-1",
      status,
      escalationReason: escalationReason ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }
}

class FakeFaqCachePort implements FaqCachePort {
  constructor(private readonly match: { answer: string } | undefined) {}
  async findBestMatch(): Promise<{ answer: string } | undefined> {
    return this.match;
  }
}

class FakeSemanticCachePort implements SemanticCachePort {
  constructor(private readonly match: { answer: string } | undefined) {}
  async findBestMatch(): Promise<{ answer: string } | undefined> {
    return this.match;
  }
  async save(): Promise<void> {}
}

class FakeRetrievalPort implements RetrievalPort {
  async findBestMatches(): Promise<{ content: string }[]> {
    return [];
  }
}

class FakeCompletionPort {
  constructor(private readonly behavior: "success" | "low-confidence" | "throw") {}
  async complete(): Promise<{ content: string; confidence: { score: number } }> {
    throw new Error("not used in this test");
  }
  async *completeStream(): AsyncIterable<{ contentDelta: string; done: boolean; result?: { content: string; confidence: { score: number } } }> {
    if (this.behavior === "throw") {
      throw new Error("completion provider unavailable");
    }
    yield { contentDelta: "Our ", done: false };
    yield { contentDelta: "return policy is 30 days.", done: false };
    const score = this.behavior === "low-confidence" ? 0 : 1;
    yield { contentDelta: "", done: true, result: { content: "Our return policy is 30 days.", confidence: { score } } };
  }
}

class FakeEscalationNotifierPort implements EscalationNotifierPort {
  async notify(): Promise<void> {}
}

function makeConversations(): FakeConversationRepository {
  return new FakeConversationRepository();
}

describe("IncomingWidgetMessageUseCase", () => {
  it("answers from the FAQ cache without touching completion", async () => {
    const conversations = makeConversations();
    const useCase = new IncomingWidgetMessageUseCase(
      conversations,
      new FakeFaqCachePort({ answer: "We're open 9-5." }),
      new FakeSemanticCachePort(undefined),
      new FakeRetrievalPort(),
      new FakeCompletionPort("throw"),
      new EscalateConversationUseCase(conversations, new FakeEscalationNotifierPort())
    );

    const events = [];
    for await (const event of useCase.streamReply("conversation-1", "workspace-1", "What are your hours?")) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "done", message: expect.objectContaining({ content: "We're open 9-5." }) }]);
    expect(conversations.appended[0]?.resolutionPath).toBe("FaqCache");
  });

  it("answers from the semantic cache without touching completion", async () => {
    const conversations = makeConversations();
    const useCase = new IncomingWidgetMessageUseCase(
      conversations,
      new FakeFaqCachePort(undefined),
      new FakeSemanticCachePort({ answer: "We ship worldwide." }),
      new FakeRetrievalPort(),
      new FakeCompletionPort("throw"),
      new EscalateConversationUseCase(conversations, new FakeEscalationNotifierPort())
    );

    const events = [];
    for await (const event of useCase.streamReply("conversation-1", "workspace-1", "Do you ship internationally?")) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "done", message: expect.objectContaining({ content: "We ship worldwide." }) }]);
    expect(conversations.appended[0]?.resolutionPath).toBe("SemanticCache");
  });

  it("streams chunks then a done event on a confident completion", async () => {
    const conversations = makeConversations();
    const useCase = new IncomingWidgetMessageUseCase(
      conversations,
      new FakeFaqCachePort(undefined),
      new FakeSemanticCachePort(undefined),
      new FakeRetrievalPort(),
      new FakeCompletionPort("success"),
      new EscalateConversationUseCase(conversations, new FakeEscalationNotifierPort())
    );

    const events = [];
    for await (const event of useCase.streamReply("conversation-1", "workspace-1", "What is your return policy?")) {
      events.push(event);
    }

    expect(events[0]).toEqual({ type: "chunk", delta: "Our " });
    expect(events[1]).toEqual({ type: "chunk", delta: "return policy is 30 days." });
    expect(events[2]).toEqual({
      type: "done",
      message: expect.objectContaining({ content: "Our return policy is 30 days.", resolutionPath: "Retrieval" })
    });
  });

  it("escalates when the streamed completion is low-confidence", async () => {
    const conversations = makeConversations();
    const useCase = new IncomingWidgetMessageUseCase(
      conversations,
      new FakeFaqCachePort(undefined),
      new FakeSemanticCachePort(undefined),
      new FakeRetrievalPort(),
      new FakeCompletionPort("low-confidence"),
      new EscalateConversationUseCase(conversations, new FakeEscalationNotifierPort())
    );

    const events = [];
    for await (const event of useCase.streamReply("conversation-1", "workspace-1", "Something obscure?")) {
      events.push(event);
    }

    const doneEvent = events[events.length - 1];
    expect(doneEvent?.type).toBe("done");
    if (doneEvent?.type === "done") {
      expect(doneEvent.message.resolutionPath).toBe("Escalated");
    }
  });

  it("emits a fallback done event when completeStream throws", async () => {
    const conversations = makeConversations();
    const useCase = new IncomingWidgetMessageUseCase(
      conversations,
      new FakeFaqCachePort(undefined),
      new FakeSemanticCachePort(undefined),
      new FakeRetrievalPort(),
      new FakeCompletionPort("throw"),
      new EscalateConversationUseCase(conversations, new FakeEscalationNotifierPort())
    );

    const events = [];
    for await (const event of useCase.streamReply("conversation-1", "workspace-1", "Anything?")) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("done");
    if (events[0]?.type === "done") {
      expect(events[0].message.content).toContain("having trouble connecting");
    }
  });
});
