import { describe, expect, it } from "vitest";
import type { Conversation, Message } from "../domain/entities.js";
import type { AppendMessageInput, ConversationRepository, StartConversationInput } from "./ports.js";
import { StartConversationUseCase } from "./start-conversation-use-case.js";

class FakeConversationRepository implements ConversationRepository {
  public created: StartConversationInput[] = [];

  async create(input: StartConversationInput) {
    this.created.push(input);
    const conversation: Conversation = {
      id: "conversation-1",
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      customerRef: input.customerRef,
      status: "Open",
      escalationReason: null
    };
    const message: Message = {
      id: "message-1",
      conversationId: conversation.id,
      sender: "Customer",
      content: input.message,
      resolutionPath: null,
      createdAt: new Date(0)
    };
    return { conversation, message };
  }

  async findById(): Promise<Conversation | undefined> {
    throw new Error("not used in this test");
  }

  async appendMessage(_input: AppendMessageInput): Promise<Message> {
    throw new Error("not used in this test");
  }

  async updateStatus(): Promise<Conversation> {
    throw new Error("not used in this test");
  }
}

describe("StartConversationUseCase", () => {
  it("creates an Open conversation with the first customer message", async () => {
    const repo = new FakeConversationRepository();
    const useCase = new StartConversationUseCase(repo);

    const result = await useCase.execute({
      workspaceId: "workspace-1",
      channelId: "channel-1",
      customerRef: "customer-1",
      message: "Hi, I need help with my order."
    });

    expect(result.conversation.status).toBe("Open");
    expect(result.message.sender).toBe("Customer");
    expect(result.message.content).toBe("Hi, I need help with my order.");
    expect(repo.created).toEqual([
      { workspaceId: "workspace-1", channelId: "channel-1", customerRef: "customer-1", message: "Hi, I need help with my order." }
    ]);
  });
});
