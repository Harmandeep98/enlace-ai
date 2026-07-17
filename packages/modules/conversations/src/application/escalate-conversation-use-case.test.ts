import { describe, expect, it } from "vitest";
import { ConversationNotFoundError, EscalationReasonRequiredError } from "../domain/errors.js";
import type { Conversation, Message } from "../domain/entities.js";
import type { AppendMessageInput, ConversationRepository } from "./ports.js";
import { EscalateConversationUseCase } from "./escalate-conversation-use-case.js";

class FakeConversationRepository implements ConversationRepository {
  public statusUpdates: { conversationId: string; workspaceId: string; status: Conversation["status"]; escalationReason: Conversation["escalationReason"] }[] = [];
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

  async updateStatus(
    conversationId: string,
    workspaceId: string,
    status: Conversation["status"],
    escalationReason: Conversation["escalationReason"] | undefined
  ): Promise<Conversation> {
    const resolvedReason = escalationReason ?? null;
    this.statusUpdates.push({ conversationId, workspaceId, status, escalationReason: resolvedReason });
    return { ...(this.existing as Conversation), status, escalationReason: resolvedReason };
  }
}

function makeConversation(): Conversation {
  return { id: "conversation-1", workspaceId: "workspace-1", channelId: "channel-1", customerRef: "customer-1", status: "Open", escalationReason: null };
}

describe("EscalateConversationUseCase", () => {
  it("transitions to Escalated and records the reason", async () => {
    const repo = new FakeConversationRepository(makeConversation());
    const useCase = new EscalateConversationUseCase(repo);

    const result = await useCase.execute({ conversationId: "conversation-1", workspaceId: "workspace-1", reason: "LowConfidence" });

    expect(result.status).toBe("Escalated");
    expect(result.escalationReason).toBe("LowConfidence");
    expect(repo.statusUpdates).toEqual([
      { conversationId: "conversation-1", workspaceId: "workspace-1", status: "Escalated", escalationReason: "LowConfidence" }
    ]);
  });

  it("throws EscalationReasonRequiredError when no reason is given", async () => {
    const repo = new FakeConversationRepository(makeConversation());
    const useCase = new EscalateConversationUseCase(repo);

    await expect(
      useCase.execute({ conversationId: "conversation-1", workspaceId: "workspace-1", reason: undefined })
    ).rejects.toThrow(EscalationReasonRequiredError);
  });

  it("throws ConversationNotFoundError when the conversation doesn't exist in that workspace", async () => {
    const repo = new FakeConversationRepository(undefined);
    const useCase = new EscalateConversationUseCase(repo);

    await expect(
      useCase.execute({ conversationId: "missing", workspaceId: "workspace-1", reason: "LowConfidence" })
    ).rejects.toThrow(ConversationNotFoundError);
  });
});
