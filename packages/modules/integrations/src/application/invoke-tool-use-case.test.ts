import { describe, expect, it } from "vitest";
import { IntegrationConnectionNotFoundError } from "../domain/errors.js";
import type { IntegrationConnection, ToolCallResult, ToolSchema } from "../domain/entities.js";
import type { IntegrationAdapter, IntegrationConnectionRepository } from "./ports.js";
import { InvokeToolUseCase } from "./invoke-tool-use-case.js";

class FakeIntegrationConnectionRepository implements IntegrationConnectionRepository {
  constructor(private readonly connection: IntegrationConnection | undefined, private readonly credential: string | undefined) {}

  async create(): Promise<IntegrationConnection> {
    throw new Error("not used in this test");
  }

  async findByWorkspaceAndType(): Promise<IntegrationConnection | undefined> {
    return this.connection;
  }

  async getDecryptedCredential(): Promise<string | undefined> {
    return this.credential;
  }
}

class FakeWebhookAdapter implements IntegrationAdapter {
  readonly type = "Webhook" as const;
  public invokeCalls: { name: string; args: Record<string, unknown>; config: unknown; credential: string | undefined }[] = [];

  getToolSchemas(config: unknown): ToolSchema[] {
    return [{ name: "get_order_status", description: "desc", parameters: {} }];
  }

  async invokeTool(name: string, args: Record<string, unknown>, config: unknown, credential: string | undefined): Promise<ToolCallResult> {
    this.invokeCalls.push({ name, args, config, credential });
    return { id: "result-1", content: "order shipped" };
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }
}

function makeConnection(): IntegrationConnection {
  return { id: "connection-1", workspaceId: "ws-1", type: "Webhook", config: { url: "https://example.com" }, status: "Active" };
}

describe("InvokeToolUseCase", () => {
  it("listToolSchemas returns the Webhook connection's schemas when one exists", async () => {
    const connections = new FakeIntegrationConnectionRepository(makeConnection(), "secret");
    const adapter = new FakeWebhookAdapter();
    const useCase = new InvokeToolUseCase(connections, { Webhook: adapter });

    const schemas = await useCase.listToolSchemas("ws-1");

    expect(schemas).toEqual([{ name: "get_order_status", description: "desc", parameters: {} }]);
  });

  it("listToolSchemas returns an empty array when no Webhook connection exists", async () => {
    const connections = new FakeIntegrationConnectionRepository(undefined, undefined);
    const useCase = new InvokeToolUseCase(connections, { Webhook: new FakeWebhookAdapter() });

    const schemas = await useCase.listToolSchemas("ws-1");

    expect(schemas).toEqual([]);
  });

  it("invoke resolves the connection, decrypts the credential, and calls the adapter", async () => {
    const connections = new FakeIntegrationConnectionRepository(makeConnection(), "secret");
    const adapter = new FakeWebhookAdapter();
    const useCase = new InvokeToolUseCase(connections, { Webhook: adapter });

    const result = await useCase.invoke("get_order_status", { orderId: "12345" }, "ws-1");

    expect(result.content).toBe("order shipped");
    expect(adapter.invokeCalls).toEqual([{ name: "get_order_status", args: { orderId: "12345" }, config: { url: "https://example.com" }, credential: "secret" }]);
  });

  it("invoke throws IntegrationConnectionNotFoundError when no Webhook connection exists", async () => {
    const connections = new FakeIntegrationConnectionRepository(undefined, undefined);
    const useCase = new InvokeToolUseCase(connections, { Webhook: new FakeWebhookAdapter() });

    await expect(useCase.invoke("get_order_status", {}, "ws-1")).rejects.toThrow(IntegrationConnectionNotFoundError);
  });
});
