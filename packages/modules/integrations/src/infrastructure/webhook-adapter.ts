import { createHmac, randomUUID } from "node:crypto";
import type { IntegrationAdapter } from "../application/ports.js";
import type { ToolCallResult, ToolSchema } from "../domain/entities.js";

interface WebhookConfig {
  url: string;
  toolName: string;
  toolDescription: string;
  toolParameters: Record<string, unknown>;
}

function sign(body: string, credential: string): string {
  return createHmac("sha256", credential).update(body).digest("hex");
}

async function post(url: string, body: string, signature: string): Promise<{ status: number; text: string }> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Enlace-Signature": signature },
    body
  });
  return { status: response.status, text: await response.text() };
}

export class WebhookAdapter implements IntegrationAdapter {
  readonly type = "Webhook" as const;

  getToolSchemas(config: unknown): ToolSchema[] {
    const webhookConfig = config as WebhookConfig;
    return [{ name: webhookConfig.toolName, description: webhookConfig.toolDescription, parameters: webhookConfig.toolParameters }];
  }

  async invokeTool(name: string, args: Record<string, unknown>, config: unknown, credential: string | undefined): Promise<ToolCallResult> {
    const webhookConfig = config as WebhookConfig;
    const body = JSON.stringify({ name, args });
    const signature = sign(body, credential ?? "");
    const { status, text } = await post(webhookConfig.url, body, signature);
    if (status < 200 || status >= 300) {
      throw new Error(`Webhook tool call failed with status ${status}: ${text}`);
    }
    return { id: randomUUID(), content: text };
  }

  async validateConfig(config: unknown, credential: string | undefined): Promise<{ valid: boolean; error?: string }> {
    const webhookConfig = config as WebhookConfig;
    const body = JSON.stringify({ ping: true });
    const signature = sign(body, credential ?? "");
    try {
      const { status, text } = await post(webhookConfig.url, body, signature);
      if (status < 200 || status >= 300) {
        return { valid: false, error: `Webhook responded with status ${status}: ${text}` };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Webhook validation request failed." };
    }
  }
}
