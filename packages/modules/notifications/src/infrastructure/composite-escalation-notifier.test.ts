import { describe, expect, it } from "vitest";
import type { SlackNotifierPort } from "./composite-escalation-notifier.js";
import { CompositeEscalationNotifier } from "./composite-escalation-notifier.js";

class FakeEmailNotifier {
  public calls: { workspaceId: string; conversationId: string; reason: string }[] = [];
  constructor(private readonly behavior: "succeed" | "throw" = "succeed") {}

  async notify(input: { workspaceId: string; conversationId: string; reason: string }): Promise<void> {
    this.calls.push(input);
    if (this.behavior === "throw") throw new Error("SMTP is down");
  }
}

class FakeSlackNotifier implements SlackNotifierPort {
  public calls: string[] = [];
  constructor(private readonly behavior: "succeed" | "throw" = "succeed") {}

  async notify(text: string): Promise<void> {
    this.calls.push(text);
    if (this.behavior === "throw") throw new Error("Slack webhook unreachable");
  }
}

describe("CompositeEscalationNotifier", () => {
  it("always calls the email notifier", async () => {
    const email = new FakeEmailNotifier();
    const notifier = new CompositeEscalationNotifier(email as never, async () => undefined);

    await notifier.notify({ workspaceId: "ws-1", conversationId: "conversation-1", reason: "LowConfidence" });

    expect(email.calls).toEqual([{ workspaceId: "ws-1", conversationId: "conversation-1", reason: "LowConfidence" }]);
  });

  it("also calls Slack when the workspace has one configured", async () => {
    const email = new FakeEmailNotifier();
    const slack = new FakeSlackNotifier();
    const notifier = new CompositeEscalationNotifier(email as never, async () => slack);

    await notifier.notify({ workspaceId: "ws-1", conversationId: "conversation-1", reason: "LowConfidence" });

    expect(slack.calls).toEqual(["Conversation escalated (LowConfidence)\nConversation ID: conversation-1\nWorkspace ID: ws-1"]);
  });

  it("does not call Slack when the workspace has none configured", async () => {
    const email = new FakeEmailNotifier();
    const notifier = new CompositeEscalationNotifier(email as never, async () => undefined);

    await expect(
      notifier.notify({ workspaceId: "ws-1", conversationId: "conversation-1", reason: "LowConfidence" })
    ).resolves.toBeUndefined();
  });

  it("a Slack failure does not block email and does not throw", async () => {
    const email = new FakeEmailNotifier();
    const slack = new FakeSlackNotifier("throw");
    const notifier = new CompositeEscalationNotifier(email as never, async () => slack);

    await expect(
      notifier.notify({ workspaceId: "ws-1", conversationId: "conversation-1", reason: "LowConfidence" })
    ).resolves.toBeUndefined();
    expect(email.calls).toHaveLength(1);
  });

  it("an email failure does not block Slack and does not throw", async () => {
    const email = new FakeEmailNotifier("throw");
    const slack = new FakeSlackNotifier();
    const notifier = new CompositeEscalationNotifier(email as never, async () => slack);

    await expect(
      notifier.notify({ workspaceId: "ws-1", conversationId: "conversation-1", reason: "LowConfidence" })
    ).resolves.toBeUndefined();
    expect(slack.calls).toHaveLength(1);
  });
});
