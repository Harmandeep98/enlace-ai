export interface SlackNotifierPort {
  notify(text: string): Promise<void>;
}

interface EmailNotifierPort {
  notify(input: { workspaceId: string; conversationId: string; reason: string }): Promise<void>;
}

export class CompositeEscalationNotifier {
  constructor(
    private readonly email: EmailNotifierPort,
    private readonly resolveSlack: (workspaceId: string) => Promise<SlackNotifierPort | undefined>
  ) {}

  async notify(input: { workspaceId: string; conversationId: string; reason: string }): Promise<void> {
    try {
      await this.email.notify(input);
    } catch (error) {
      console.warn(`Failed to send escalation email for conversation ${input.conversationId}:`, error);
    }

    try {
      const slack = await this.resolveSlack(input.workspaceId);
      if (slack) {
        await slack.notify(`Conversation escalated (${input.reason})\nConversation ID: ${input.conversationId}\nWorkspace ID: ${input.workspaceId}`);
      }
    } catch (error) {
      console.warn(`Failed to send escalation Slack notification for conversation ${input.conversationId}:`, error);
    }
  }
}
