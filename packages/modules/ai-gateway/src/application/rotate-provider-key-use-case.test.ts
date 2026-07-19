import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "../domain/entities.js";
import { ProviderConfigNotFoundError, ProviderKeyValidationFailedError } from "../domain/errors.js";
import type { ProviderConfigRepository, ProviderKeyValidator } from "./ports.js";
import { RotateProviderKeyUseCase } from "./rotate-provider-key-use-case.js";

const EXISTING: ProviderConfig = { id: "config-1", workspaceId: "ws-1", provider: "Anthropic", keyMode: "BringYourOwn", status: "Active" };

class FakeProviderConfigRepository implements ProviderConfigRepository {
  rotated: { id: string; workspaceId: string; credential: string }[] = [];
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
  async updateStatus(): Promise<void> {}
  async rotateCredential(id: string, workspaceId: string, credential: string): Promise<ProviderConfig> {
    this.rotated.push({ id, workspaceId, credential });
    return this.existing!;
  }
}

class FakeProviderKeyValidator implements ProviderKeyValidator {
  constructor(private readonly result: boolean) {}
  async validate(): Promise<boolean> {
    return this.result;
  }
}

describe("RotateProviderKeyUseCase", () => {
  it("rotates the credential when validation succeeds", async () => {
    const repo = new FakeProviderConfigRepository(EXISTING);
    const useCase = new RotateProviderKeyUseCase(repo, new FakeProviderKeyValidator(true));

    await useCase.execute({ configId: "config-1", workspaceId: "ws-1", credential: "sk-ant-new" });

    expect(repo.rotated[0]).toEqual({ id: "config-1", workspaceId: "ws-1", credential: "sk-ant-new" });
  });

  it("rejects when the config doesn't exist", async () => {
    const repo = new FakeProviderConfigRepository(undefined);
    const useCase = new RotateProviderKeyUseCase(repo, new FakeProviderKeyValidator(true));

    await expect(useCase.execute({ configId: "missing", workspaceId: "ws-1", credential: "sk-new" })).rejects.toThrow(
      ProviderConfigNotFoundError
    );
  });

  it("rejects and does not rotate when validation fails", async () => {
    const repo = new FakeProviderConfigRepository(EXISTING);
    const useCase = new RotateProviderKeyUseCase(repo, new FakeProviderKeyValidator(false));

    await expect(useCase.execute({ configId: "config-1", workspaceId: "ws-1", credential: "sk-bad" })).rejects.toThrow(
      ProviderKeyValidationFailedError
    );
    expect(repo.rotated).toHaveLength(0);
  });
});
