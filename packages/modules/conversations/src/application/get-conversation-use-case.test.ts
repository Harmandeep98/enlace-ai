import { describe, expect, it } from "vitest";
import { ConversationNotFoundError } from "../domain/errors.js";
import type { Conversation, Message } from "../domain/entities.js";
import type { AppendMessageInput, ConversationRepository } from "./ports.js";
import { GetConversationUseCase } from "./get-conversation-use-case.js";

class FakeConversationRepository implements ConversationRepository {
  constructor(private readonly existing: Conversation | undefined) {}

  async create(): Promise<{ conversation: Conversation; message: Message }> {
    throw new Error("not used in this test");
  }

  async findById(): Promise<Conversation | undefined> {
    return this.existing;
  }

  async appendMessage(_input: AppendMessageInput): Promise<Message> {
    throw new Error("not used in this test");
  }

  async updateStatus(): Promise<Conversation> {
    throw new Error("not used in this test");
  }
}

describe("GetConversationUseCase", () => {
  it("returns the conversation when it exists in that workspace", async () => {
    const conversation: Conversation = {
      id: "conversation-1",
      workspaceId: "workspace-1",
      channelId: "channel-1",
      customerRef: "customer-1",
      status: "Open",
      escalationReason: null
    };
    const useCase = new GetConversationUseCase(new FakeConversationRepository(conversation));

    const result = await useCase.execute({ conversationId: "conversation-1", workspaceId: "workspace-1" });

    expect(result).toEqual(conversation);
  });

  it("throws ConversationNotFoundError when it doesn't exist in that workspace", async () => {
    const useCase = new GetConversationUseCase(new FakeConversationRepository(undefined));

    await expect(useCase.execute({ conversationId: "missing", workspaceId: "workspace-1" })).rejects.toThrow(ConversationNotFoundError);
  });
});
