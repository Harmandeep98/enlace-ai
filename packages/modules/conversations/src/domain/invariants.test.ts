import { describe, expect, it } from "vitest";
import { ConversationNotOpenError, EscalationReasonRequiredError } from "./errors.js";
import { assertCanAddCustomerMessage, assertValidEscalation } from "./invariants.js";
import type { Conversation } from "./entities.js";

function makeConversation(status: Conversation["status"]): Conversation {
  return { id: "conv-1", workspaceId: "ws-1", channelId: "chan-1", customerRef: "cust-1", status, escalationReason: null };
}

describe("assertCanAddCustomerMessage", () => {
  it("allows a customer message on an Open conversation", () => {
    expect(() => assertCanAddCustomerMessage(makeConversation("Open"))).not.toThrow();
  });

  it("throws ConversationNotOpenError on a Resolved conversation", () => {
    expect(() => assertCanAddCustomerMessage(makeConversation("Resolved"))).toThrow(ConversationNotOpenError);
  });
});

describe("assertValidEscalation", () => {
  it("allows escalation when a reason is given", () => {
    expect(() => assertValidEscalation("LowConfidence")).not.toThrow();
  });

  it("throws EscalationReasonRequiredError when no reason is given", () => {
    expect(() => assertValidEscalation(undefined)).toThrow(EscalationReasonRequiredError);
  });
});
