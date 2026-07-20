import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "../domain/entities.js";
import { CredentialRequiredError, PlatformKeyModeRequiresGoogleError, ProviderKeyValidationFailedError } from "../domain/errors.js";
import type { ProviderConfigRepository, ProviderKeyValidator, UpsertProviderConfigInput } from "./ports.js";
import { ConfigureProviderUseCase } from "./configure-provider-use-case.js";

class FakeProviderConfigRepository implements ProviderConfigRepository {
  upserted: UpsertProviderConfigInput[] = [];
  async upsert(input: UpsertProviderConfigInput): Promise<ProviderConfig> {
    this.upserted.push(input);
    return { id: "config-1", workspaceId: input.workspaceId, provider: input.provider, keyMode: input.keyMode, status: "Active" };
  }
  async listByWorkspace(): Promise<ProviderConfig[]> {
    return [];
  }
  async findById(): Promise<ProviderConfig | undefined> {
    return undefined;
  }
  async updateStatus(): Promise<void> {}
  async rotateCredential(): Promise<ProviderConfig> {
    throw new Error("not used in this test");
  }
  async getDecryptedCredential(): Promise<string | null> {
    return null;
  }
}

class FakeProviderKeyValidator implements ProviderKeyValidator {
  constructor(private readonly result: boolean) {}
  async validate(): Promise<boolean> {
    return this.result;
  }
}

describe("ConfigureProviderUseCase", () => {
  it("persists a Platform+Google config with no validation call", async () => {
    const repo = new FakeProviderConfigRepository();
    const useCase = new ConfigureProviderUseCase(repo, new FakeProviderKeyValidator(false));

    const config = await useCase.execute({ workspaceId: "ws-1", provider: "Google", keyMode: "Platform" });

    expect(config.provider).toBe("Google");
    expect(repo.upserted[0]?.credential).toBeNull();
  });

  it("rejects Platform mode for a non-Google provider", async () => {
    const repo = new FakeProviderConfigRepository();
    const useCase = new ConfigureProviderUseCase(repo, new FakeProviderKeyValidator(true));

    await expect(useCase.execute({ workspaceId: "ws-1", provider: "OpenAI", keyMode: "Platform" })).rejects.toThrow(
      PlatformKeyModeRequiresGoogleError
    );
  });

  it("rejects BringYourOwn with no credential", async () => {
    const repo = new FakeProviderConfigRepository();
    const useCase = new ConfigureProviderUseCase(repo, new FakeProviderKeyValidator(true));

    await expect(useCase.execute({ workspaceId: "ws-1", provider: "OpenAI", keyMode: "BringYourOwn" })).rejects.toThrow(
      CredentialRequiredError
    );
  });

  it("validates a BringYourOwn credential before persisting, and persists on success", async () => {
    const repo = new FakeProviderConfigRepository();
    const useCase = new ConfigureProviderUseCase(repo, new FakeProviderKeyValidator(true));

    await useCase.execute({ workspaceId: "ws-1", provider: "OpenAI", keyMode: "BringYourOwn", credential: "sk-test" });

    expect(repo.upserted[0]?.credential).toBe("sk-test");
  });

  it("rejects and does not persist when validation fails", async () => {
    const repo = new FakeProviderConfigRepository();
    const useCase = new ConfigureProviderUseCase(repo, new FakeProviderKeyValidator(false));

    await expect(
      useCase.execute({ workspaceId: "ws-1", provider: "OpenAI", keyMode: "BringYourOwn", credential: "sk-bad" })
    ).rejects.toThrow(ProviderKeyValidationFailedError);
    expect(repo.upserted).toHaveLength(0);
  });
});
