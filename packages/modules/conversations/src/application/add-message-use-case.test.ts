import { describe, expect, it } from "vitest";
import { ConversationNotFoundError, ConversationNotOpenError } from "../domain/errors.js";
import type { Conversation, Message } from "../domain/entities.js";
import type { AppendMessageInput, ConversationRepository } from "./ports.js";
import { AddMessageUseCase } from "./add-message-use-case.js";

class FakeConversationRepository implements ConversationRepository {
  public appended: AppendMessageInput[] = [];
  constructor(private readonly existing: Conversation | undefined) {}

  async create(): Promise<{ conversation: Conversation; message: Message }> {
    throw new Error("not used in this test");
  }

  async findById(): Promise<Conversation | undefined> {
    return this.existing;
  }

  async listConversations(): Promise<Conversation[]> {
    return [];
  }

  async appendMessage(input: AppendMessageInput): Promise<Message> {
    this.appended.push(input);
    return {
      id: "message-2",
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

  async listMessages(): Promise<Message[]> {
    return [];
  }
}

function makeConversation(status: Conversation["status"]): Conversation {
  return {
    id: "conversation-1",
    workspaceId: "workspace-1",
    channelId: "channel-1",
    customerRef: "customer-1",
    status,
    escalationReason: null,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

describe("AddMessageUseCase", () => {
  it("appends a customer message to an Open conversation", async () => {
    const repo = new FakeConversationRepository(makeConversation("Open"));
    const useCase = new AddMessageUseCase(repo);

    const message = await useCase.execute({ conversationId: "conversation-1", workspaceId: "workspace-1", sender: "Customer", content: "Still there?" });

    expect(message.content).toBe("Still there?");
    expect(repo.appended).toEqual([
      { conversationId: "conversation-1", workspaceId: "workspace-1", sender: "Customer", content: "Still there?", resolutionPath: null }
    ]);
  });

  it("throws ConversationNotOpenError when a customer messages a Resolved conversation", async () => {
    const repo = new FakeConversationRepository(makeConversation("Resolved"));
    const useCase = new AddMessageUseCase(repo);

    await expect(
      useCase.execute({ conversationId: "conversation-1", workspaceId: "workspace-1", sender: "Customer", content: "Hello?" })
    ).rejects.toThrow(ConversationNotOpenError);
  });

  it("throws ConversationNotFoundError when the conversation doesn't exist in that workspace", async () => {
    const repo = new FakeConversationRepository(undefined);
    const useCase = new AddMessageUseCase(repo);

    await expect(
      useCase.execute({ conversationId: "missing", workspaceId: "workspace-1", sender: "Customer", content: "Hello?" })
    ).rejects.toThrow(ConversationNotFoundError);
  });
});
