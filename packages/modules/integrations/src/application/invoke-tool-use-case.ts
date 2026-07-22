import { IntegrationConnectionNotFoundError } from "../domain/errors.js";
import type { IntegrationType, ToolSchema } from "../domain/entities.js";
import type { IntegrationAdapter, IntegrationConnectionRepository } from "./ports.js";

// Every type that can offer tools to the model — Slack is deliberately excluded (send-only for
// escalation, per docs/14-integration-architecture.md §4, never a tool-calling participant).
const TOOL_CALLING_TYPES: IntegrationType[] = ["Webhook", "Zendesk"];

export class InvokeToolUseCase {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly adapters: Partial<Record<IntegrationType, IntegrationAdapter>>
  ) {}

  async listToolSchemas(workspaceId: string): Promise<ToolSchema[]> {
    const schemas: ToolSchema[] = [];
    for (const type of TOOL_CALLING_TYPES) {
      const adapter = this.adapters[type];
      if (!adapter) continue;
      const connection = await this.connections.findByWorkspaceAndType(workspaceId, type);
      if (!connection) continue;
      schemas.push(...adapter.getToolSchemas(connection.config));
    }
    return schemas;
  }

  async invoke(toolName: string, args: Record<string, unknown>, workspaceId: string, conversationId: string): Promise<{ content: string }> {
    for (const type of TOOL_CALLING_TYPES) {
      const adapter = this.adapters[type];
      if (!adapter) continue;
      const connection = await this.connections.findByWorkspaceAndType(workspaceId, type);
      if (!connection) continue;
      const offersThisTool = adapter.getToolSchemas(connection.config).some((schema) => schema.name === toolName);
      if (!offersThisTool) continue;

      const credential = await this.connections.getDecryptedCredential(connection.id, workspaceId);
      const result = await adapter.invokeTool(toolName, args, connection.config, credential, { conversationId });
      return { content: result.content };
    }
    throw new IntegrationConnectionNotFoundError();
  }
}
