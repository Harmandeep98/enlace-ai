import { describe, expect, it, vi } from "vitest";
import { ConversationEventBus } from "./conversation-event-bus.js";

function makeMessageEvent(conversationId: string) {
  return {
    type: "message" as const,
    conversationId,
    message: {
      id: "message-1",
      conversationId,
      sender: "Customer" as const,
      content: "Hi",
      resolutionPath: null,
      createdAt: new Date(0)
    }
  };
}

describe("ConversationEventBus", () => {
  it("delivers an emitted event only to subscribers of that workspace", () => {
    const bus = new ConversationEventBus();
    const workspaceAListener = vi.fn();
    const workspaceBListener = vi.fn();
    bus.subscribe("workspace-a", workspaceAListener);
    bus.subscribe("workspace-b", workspaceBListener);

    const event = makeMessageEvent("conversation-1");
    bus.emit("workspace-a", event);

    expect(workspaceAListener).toHaveBeenCalledWith(event);
    expect(workspaceBListener).not.toHaveBeenCalled();
  });

  it("stops delivering events after unsubscribe", () => {
    const bus = new ConversationEventBus();
    const listener = vi.fn();
    const unsubscribe = bus.subscribe("workspace-a", listener);
    unsubscribe();

    bus.emit("workspace-a", makeMessageEvent("conversation-1"));

    expect(listener).not.toHaveBeenCalled();
  });
});
