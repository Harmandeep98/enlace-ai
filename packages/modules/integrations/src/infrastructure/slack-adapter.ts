import type { IntegrationAdapter } from "../application/ports.js";
import type { ToolCallResult, ToolSchema } from "../domain/entities.js";

interface SlackConfig {
  webhookUrl: string;
}

async function post(webhookUrl: string, text: string): Promise<{ status: number; text: string }> {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return { status: response.status, text: await response.text() };
}

export class SlackAdapter implements IntegrationAdapter {
  readonly type = "Slack" as const;

  // Slack is send-only for escalation notifications (docs/14-integration-architecture.md §4) —
  // it never offers tools to the model.
  getToolSchemas(_config: unknown): ToolSchema[] {
    return [];
  }

  async invokeTool(
    _name: string,
    _args: Record<string, unknown>,
    _config: unknown,
    _credential: string | undefined
  ): Promise<ToolCallResult> {
    throw new Error("Slack does not support tool invocation.");
  }

  async validateConfig(config: unknown, _credential: string | undefined): Promise<{ valid: boolean; error?: string }> {
    const { webhookUrl } = config as SlackConfig;
    try {
      const { status, text } = await post(webhookUrl, "Enlace Ai connected to this Slack channel.");
      if (status < 200 || status >= 300) {
        return { valid: false, error: `Slack responded with status ${status}: ${text}` };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Slack validation request failed." };
    }
  }

  async notify(text: string, config: unknown): Promise<void> {
    const { webhookUrl } = config as SlackConfig;
    const { status, text: responseText } = await post(webhookUrl, text);
    if (status < 200 || status >= 300) {
      throw new Error(`Slack notify failed with status ${status}: ${responseText}`);
    }
  }
}
