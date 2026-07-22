import { describe, expect, it } from "vitest";
import { IntegrationValidationFailedError } from "../domain/errors.js";
import type { IntegrationConnection, ToolCallResult, ToolSchema } from "../domain/entities.js";
import type { CreateIntegrationConnectionInput, IntegrationAdapter, IntegrationConnectionRepository } from "./ports.js";
import { CreateIntegrationConnectionUseCase } from "./create-integration-connection-use-case.js";

class FakeIntegrationConnectionRepository implements IntegrationConnectionRepository {
  public created: CreateIntegrationConnectionInput[] = [];

  async create(input: CreateIntegrationConnectionInput): Promise<IntegrationConnection> {
    this.created.push(input);
    return { id: "connection-1", workspaceId: input.workspaceId, type: input.type, config: input.config, status: "Active" };
  }

  async findByWorkspaceAndType(): Promise<IntegrationConnection | undefined> {
    throw new Error("not used in this test");
  }

  async getDecryptedCredential(): Promise<string | undefined> {
    throw new Error("not used in this test");
  }
}

class FakeWebhookAdapter implements IntegrationAdapter {
  readonly type = "Webhook" as const;
  constructor(private readonly validationResult: { valid: boolean; error?: string }) {}

  getToolSchemas(): ToolSchema[] {
    return [];
  }

  async invokeTool(): Promise<ToolCallResult> {
    throw new Error("not used in this test");
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    return this.validationResult;
  }
}

class FakeZendeskSyncTriggerPort {
  public calls: { workspaceId: string; connectionId: string }[] = [];

  async scheduleSync(workspaceId: string, connectionId: string): Promise<void> {
    this.calls.push({ workspaceId, connectionId });
  }
}

describe("CreateIntegrationConnectionUseCase", () => {
  it("persists the connection when validation passes", async () => {
    const connections = new FakeIntegrationConnectionRepository();
    const zendeskSyncTrigger = new FakeZendeskSyncTriggerPort();
    const useCase = new CreateIntegrationConnectionUseCase(connections, { Webhook: new FakeWebhookAdapter({ valid: true }) }, zendeskSyncTrigger);

    const result = await useCase.execute({ workspaceId: "ws-1", type: "Webhook", config: { url: "https://example.com" }, credential: "secret" });

    expect(result.id).toBe("connection-1");
    expect(connections.created).toEqual([{ workspaceId: "ws-1", type: "Webhook", config: { url: "https://example.com" }, credential: "secret" }]);
    expect(zendeskSyncTrigger.calls).toEqual([]);
  });

  it("throws IntegrationValidationFailedError and does not persist when validation fails", async () => {
    const connections = new FakeIntegrationConnectionRepository();
    const zendeskSyncTrigger = new FakeZendeskSyncTriggerPort();
    const useCase = new CreateIntegrationConnectionUseCase(
      connections,
      { Webhook: new FakeWebhookAdapter({ valid: false, error: "unreachable" }) },
      zendeskSyncTrigger
    );

    await expect(
      useCase.execute({ workspaceId: "ws-1", type: "Webhook", config: { url: "https://example.com" }, credential: "secret" })
    ).rejects.toThrow(IntegrationValidationFailedError);
    expect(connections.created).toEqual([]);
  });

  it("throws NoAdapterRegisteredError for a type with no registered adapter", async () => {
    const connections = new FakeIntegrationConnectionRepository();
    const zendeskSyncTrigger = new FakeZendeskSyncTriggerPort();
    const useCase = new CreateIntegrationConnectionUseCase(connections, {}, zendeskSyncTrigger);

    await expect(
      useCase.execute({ workspaceId: "ws-1", type: "Zendesk", config: {}, credential: "secret" })
    ).rejects.toThrow("No integration adapter is registered for type Zendesk yet.");
  });

  it("schedules a Zendesk sync after persisting a Zendesk connection", async () => {
    const connections = new FakeIntegrationConnectionRepository();
    const zendeskSyncTrigger = new FakeZendeskSyncTriggerPort();
    const useCase = new CreateIntegrationConnectionUseCase(
      connections,
      { Zendesk: new FakeWebhookAdapter({ valid: true }) },
      zendeskSyncTrigger
    );

    const result = await useCase.execute({ workspaceId: "ws-1", type: "Zendesk", config: { subdomain: "acme" }, credential: "token" });

    expect(zendeskSyncTrigger.calls).toEqual([{ workspaceId: "ws-1", connectionId: result.id }]);
  });
});
