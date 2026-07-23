import { describe, expect, it } from "vitest";
import type { AppendMessageInput, ConversationRepository } from "./ports.js";
import type { Conversation, Message } from "../domain/entities.js";
import { ListConversationsUseCase } from "./list-conversations-use-case.js";

class FakeConversationRepository implements ConversationRepository {
  constructor(private readonly conversations: Conversation[]) {}

  async create(): Promise<{ conversation: Conversation; message: Message }> {
    throw new Error("not used in this test");
  }

  async findById(): Promise<Conversation | undefined> {
    throw new Error("not used in this test");
  }

  async listConversations(_workspaceId: string, status?: Conversation["status"]): Promise<Conversation[]> {
    return status ? this.conversations.filter((c) => c.status === status) : this.conversations;
  }

  async appendMessage(_input: AppendMessageInput): Promise<Message> {
    throw new Error("not used in this test");
  }

  async updateStatus(): Promise<Conversation> {
    throw new Error("not used in this test");
  }

  async listMessages(): Promise<Message[]> {
    return [];
  }
}

function makeConversation(id: string, status: Conversation["status"]): Conversation {
  return {
    id,
    workspaceId: "workspace-1",
    channelId: "channel-1",
    customerRef: "customer-1",
    status,
    escalationReason: null,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

describe("ListConversationsUseCase", () => {
  it("returns every conversation for a workspace when no status filter is given", async () => {
    const repo = new FakeConversationRepository([makeConversation("c1", "Open"), makeConversation("c2", "Resolved")]);
    const useCase = new ListConversationsUseCase(repo);

    const result = await useCase.execute({ workspaceId: "workspace-1" });

    expect(result.map((c) => c.id)).toEqual(["c1", "c2"]);
  });

  it("filters by status when given", async () => {
    const repo = new FakeConversationRepository([makeConversation("c1", "Open"), makeConversation("c2", "Resolved")]);
    const useCase = new ListConversationsUseCase(repo);

    const result = await useCase.execute({ workspaceId: "workspace-1", status: "Resolved" });

    expect(result.map((c) => c.id)).toEqual(["c2"]);
  });
});
