import { describe, expect, it } from "vitest";
import type { ProviderConfig } from "../domain/entities.js";
import { NoCompletionAdapterError } from "../domain/errors.js";
import type { ProviderConfigRepository } from "./ports.js";
import { ResolveProviderForCompletionUseCase } from "./resolve-provider-for-completion-use-case.js";

class FakeProviderConfigRepository implements ProviderConfigRepository {
  constructor(
    private readonly configs: ProviderConfig[],
    private readonly credentials: Record<string, string> = {}
  ) {}
  async upsert(): Promise<ProviderConfig> {
    throw new Error("not used in this test");
  }
  async listByWorkspace(): Promise<ProviderConfig[]> {
    return this.configs;
  }
  async findById(): Promise<ProviderConfig | undefined> {
    throw new Error("not used in this test");
  }
  async updateStatus(): Promise<void> {}
  async rotateCredential(): Promise<ProviderConfig> {
    throw new Error("not used in this test");
  }
  async getDecryptedCredential(id: string): Promise<string | null> {
    return this.credentials[id] ?? null;
  }
}

const originalGeminiKey = process.env.GEMINI_API_KEY;

describe("ResolveProviderForCompletionUseCase", () => {
  it("resolves to the platform Google default when the workspace has no configs", async () => {
    process.env.GEMINI_API_KEY = "platform-key";
    const useCase = new ResolveProviderForCompletionUseCase(new FakeProviderConfigRepository([]));

    const resolved = await useCase.execute("ws-1", "small");

    expect(resolved).toEqual({ provider: "Google", model: "gemini-flash-latest", credential: "platform-key", keyMode: "Platform" });
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });

  it("resolves to the workspace's BYO Google credential when configured", async () => {
    const config: ProviderConfig = { id: "config-1", workspaceId: "ws-1", provider: "Google", keyMode: "BringYourOwn", status: "Active" };
    const useCase = new ResolveProviderForCompletionUseCase(
      new FakeProviderConfigRepository([config], { "config-1": "sk-byo-google" })
    );

    const resolved = await useCase.execute("ws-1", "large");

    expect(resolved).toEqual({ provider: "Google", model: "gemini-flash-latest", credential: "sk-byo-google", keyMode: "BringYourOwn" });
  });

  it("throws NoCompletionAdapterError for a non-Google Active config", async () => {
    const config: ProviderConfig = { id: "config-1", workspaceId: "ws-1", provider: "OpenAI", keyMode: "BringYourOwn", status: "Active" };
    const useCase = new ResolveProviderForCompletionUseCase(new FakeProviderConfigRepository([config]));

    await expect(useCase.execute("ws-1", "small")).rejects.toThrow(NoCompletionAdapterError);
  });

  it("falls back to the platform default when the only config is Disabled", async () => {
    process.env.GEMINI_API_KEY = "platform-key";
    const config: ProviderConfig = { id: "config-1", workspaceId: "ws-1", provider: "OpenAI", keyMode: "BringYourOwn", status: "Disabled" };
    const useCase = new ResolveProviderForCompletionUseCase(new FakeProviderConfigRepository([config]));

    const resolved = await useCase.execute("ws-1", "small");

    expect(resolved.provider).toBe("Google");
    process.env.GEMINI_API_KEY = originalGeminiKey;
  });
});
