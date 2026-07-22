import { IntegrationConnectionNotFoundError, NoAdapterRegisteredError } from "../domain/errors.js";
import type { IntegrationType, ToolSchema } from "../domain/entities.js";
import type { IntegrationAdapter, IntegrationConnectionRepository } from "./ports.js";

// Webhook-only for now (Plan 1 of 3) — Slack/Zendesk have no adapter registered yet, so
// listToolSchemas/invoke both only ever resolve a workspace's Webhook connection.
const TOOL_CALLING_TYPE: IntegrationType = "Webhook";

export class InvokeToolUseCase {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly adapters: Partial<Record<IntegrationType, IntegrationAdapter>>
  ) {}

  async listToolSchemas(workspaceId: string): Promise<ToolSchema[]> {
    const connection = await this.connections.findByWorkspaceAndType(workspaceId, TOOL_CALLING_TYPE);
    if (!connection) return [];
    const adapter = this.adapters[TOOL_CALLING_TYPE];
    if (!adapter) return [];
    return adapter.getToolSchemas(connection.config);
  }

  async invoke(toolName: string, args: Record<string, unknown>, workspaceId: string): Promise<{ content: string }> {
    const connection = await this.connections.findByWorkspaceAndType(workspaceId, TOOL_CALLING_TYPE);
    if (!connection) throw new IntegrationConnectionNotFoundError();

    const adapter = this.adapters[TOOL_CALLING_TYPE];
    if (!adapter) throw new NoAdapterRegisteredError(TOOL_CALLING_TYPE);

    const credential = await this.connections.getDecryptedCredential(connection.id, workspaceId);
    const result = await adapter.invokeTool(toolName, args, connection.config, credential);
    return { content: result.content };
  }
}
