import type { IntegrationConnection, IntegrationType, ToolCallResult, ToolSchema } from "../domain/entities.js";

export interface IntegrationAdapter {
  readonly type: IntegrationType;
  validateConfig(config: unknown, credential: string | undefined): Promise<{ valid: boolean; error?: string }>;
  getToolSchemas(config: unknown): ToolSchema[];
  invokeTool(name: string, args: Record<string, unknown>, config: unknown, credential: string | undefined): Promise<ToolCallResult>;
  sync?(config: unknown, credential: string | undefined): Promise<{ resolvedConversationRefs: string[] }>;
}

export interface CreateIntegrationConnectionInput {
  workspaceId: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  credential?: string;
}

export interface IntegrationConnectionRepository {
  create(input: CreateIntegrationConnectionInput): Promise<IntegrationConnection>;
  findByWorkspaceAndType(workspaceId: string, type: IntegrationType): Promise<IntegrationConnection | undefined>;
  getDecryptedCredential(connectionId: string, workspaceId: string): Promise<string | undefined>;
}
