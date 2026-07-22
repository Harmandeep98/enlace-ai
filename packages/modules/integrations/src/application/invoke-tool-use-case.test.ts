import { describe, expect, it } from "vitest";
import { IntegrationConnectionNotFoundError } from "../domain/errors.js";
import type { IntegrationConnection, IntegrationType, ToolCallResult, ToolSchema } from "../domain/entities.js";
import type { IntegrationAdapter, IntegrationConnectionRepository, ToolInvocationContext } from "./ports.js";
import { InvokeToolUseCase } from "./invoke-tool-use-case.js";

class FakeIntegrationConnectionRepository implements IntegrationConnectionRepository {
  constructor(private readonly connections: IntegrationConnection[], private readonly credentialsByConnectionId: Record<string, string | undefined>) {}

  async create(): Promise<IntegrationConnection> {
    throw new Error("not used in this test");
  }

  async findByWorkspaceAndType(workspaceId: string, type: IntegrationType): Promise<IntegrationConnection | undefined> {
    return this.connections.find((c) => c.workspaceId === workspaceId && c.type === type);
  }

  async getDecryptedCredential(connectionId: string): Promise<string | undefined> {
    return this.credentialsByConnectionId[connectionId];
  }
}

function makeAdapter(type: IntegrationType, schemas: ToolSchema[], invokeResult?: ToolCallResult) {
  const invokeCalls: { name: string; args: Record<string, unknown>; config: unknown; credential: string | undefined; context: ToolInvocationContext | undefined }[] = [];
  const adapter: IntegrationAdapter & { invokeCalls: typeof invokeCalls } = {
    type,
    invokeCalls,
    getToolSchemas: () => schemas,
    async invokeTool(name, args, config, credential, context) {
      invokeCalls.push({ name, args, config, credential, context });
      return invokeResult ?? { id: "result-1", content: "ok" };
    },
    async validateConfig() {
      return { valid: true };
    }
  };
  return adapter;
}

function makeConnection(type: IntegrationType, workspaceId = "ws-1"): IntegrationConnection {
  return { id: `connection-${type}`, workspaceId, type, config: { key: type }, status: "Active" };
}

describe("InvokeToolUseCase", () => {
  it("listToolSchemas aggregates schemas across every configured connection type", async () => {
    const webhookAdapter = makeAdapter("Webhook", [{ name: "get_order_status", description: "desc", parameters: {} }]);
    const zendeskAdapter = makeAdapter("Zendesk", [{ name: "create_zendesk_ticket", description: "desc", parameters: {} }]);
    const connections = new FakeIntegrationConnectionRepository([makeConnection("Webhook"), makeConnection("Zendesk")], {});
    const useCase = new InvokeToolUseCase(connections, { Webhook: webhookAdapter, Zendesk: zendeskAdapter });

    const schemas = await useCase.listToolSchemas("ws-1");

    expect(schemas).toEqual([
      { name: "get_order_status", description: "desc", parameters: {} },
      { name: "create_zendesk_ticket", description: "desc", parameters: {} }
    ]);
  });

  it("listToolSchemas returns an empty array when no connection exists", async () => {
    const connections = new FakeIntegrationConnectionRepository([], {});
    const useCase = new InvokeToolUseCase(connections, { Webhook: makeAdapter("Webhook", []), Zendesk: makeAdapter("Zendesk", []) });

    expect(await useCase.listToolSchemas("ws-1")).toEqual([]);
  });

  it("invoke routes to the adapter whose schema actually declares the requested tool name, passing the conversationId as context", async () => {
    const webhookAdapter = makeAdapter("Webhook", [{ name: "get_order_status", description: "desc", parameters: {} }]);
    const zendeskAdapter = makeAdapter("Zendesk", [{ name: "create_zendesk_ticket", description: "desc", parameters: {} }], {
      id: "result-1",
      content: '{"ticketId":42}'
    });
    const connections = new FakeIntegrationConnectionRepository(
      [makeConnection("Webhook"), makeConnection("Zendesk")],
      { "connection-Zendesk": "zendesk-token" }
    );
    const useCase = new InvokeToolUseCase(connections, { Webhook: webhookAdapter, Zendesk: zendeskAdapter });

    const result = await useCase.invoke("create_zendesk_ticket", { subject: "Help", description: "Needs a human." }, "ws-1", "conversation-1");

    expect(result.content).toBe('{"ticketId":42}');
    expect(zendeskAdapter.invokeCalls).toEqual([
      {
        name: "create_zendesk_ticket",
        args: { subject: "Help", description: "Needs a human." },
        config: { key: "Zendesk" },
        credential: "zendesk-token",
        context: { conversationId: "conversation-1" }
      }
    ]);
    expect(webhookAdapter.invokeCalls).toEqual([]);
  });

  it("invoke throws IntegrationConnectionNotFoundError when no connection offers the requested tool name", async () => {
    const connections = new FakeIntegrationConnectionRepository([makeConnection("Webhook")], {});
    const useCase = new InvokeToolUseCase(connections, { Webhook: makeAdapter("Webhook", [{ name: "get_order_status", description: "desc", parameters: {} }]) });

    await expect(useCase.invoke("create_zendesk_ticket", {}, "ws-1", "conversation-1")).rejects.toThrow(IntegrationConnectionNotFoundError);
  });
});
