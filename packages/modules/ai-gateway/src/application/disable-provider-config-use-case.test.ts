import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "../domain/entities.js";
import { ProviderConfigNotFoundError } from "../domain/errors.js";
import type { ProviderConfigRepository } from "./ports.js";
import { DisableProviderConfigUseCase } from "./disable-provider-config-use-case.js";

const EXISTING: ProviderConfig = { id: "config-1", workspaceId: "ws-1", provider: "Google", keyMode: "Platform", status: "Active" };

class FakeProviderConfigRepository implements ProviderConfigRepository {
  statusUpdates: { id: string; workspaceId: string; status: string }[] = [];
  constructor(private readonly existing: ProviderConfig | undefined) {}
  async upsert(): Promise<ProviderConfig> {
    throw new Error("not used in this test");
  }
  async listByWorkspace(): Promise<ProviderConfig[]> {
    return [];
  }
  async findById(): Promise<ProviderConfig | undefined> {
    return this.existing;
  }
  async updateStatus(id: string, workspaceId: string, status: ProviderConfig["status"]): Promise<void> {
    this.statusUpdates.push({ id, workspaceId, status });
  }
  async rotateCredential(): Promise<ProviderConfig> {
    throw new Error("not used in this test");
  }
}

describe("DisableProviderConfigUseCase", () => {
  it("disables an existing config", async () => {
    const repo = new FakeProviderConfigRepository(EXISTING);
    const useCase = new DisableProviderConfigUseCase(repo);

    await useCase.execute("config-1", "ws-1");

    expect(repo.statusUpdates[0]).toEqual({ id: "config-1", workspaceId: "ws-1", status: "Disabled" });
  });

  it("rejects when the config doesn't exist", async () => {
    const repo = new FakeProviderConfigRepository(undefined);
    const useCase = new DisableProviderConfigUseCase(repo);

    await expect(useCase.execute("missing", "ws-1")).rejects.toThrow(ProviderConfigNotFoundError);
  });
});
