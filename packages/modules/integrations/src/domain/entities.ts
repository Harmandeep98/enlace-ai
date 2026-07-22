export type IntegrationType = "Webhook" | "Slack" | "Zendesk";
export type IntegrationConnectionStatus = "Active" | "Disabled";

export interface IntegrationConnection {
  id: string;
  workspaceId: string;
  type: IntegrationType;
  config: Record<string, unknown>;
  status: IntegrationConnectionStatus;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallRequest {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolCallResult {
  id: string;
  content: string;
}
