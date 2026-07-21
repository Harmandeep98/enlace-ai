import type { KeyMode, Provider, Tier } from "../domain/entities.js";
import { NoCompletionAdapterError } from "../domain/errors.js";
import type { ProviderConfigRepository } from "./ports.js";

export interface ResolvedProvider {
  provider: Provider;
  model: string;
  credential: string;
  keyMode: KeyMode;
}

// Both tiers map to the same model for Google today — no stronger reachable model exists on
// this project's free-tier key (docs/superpowers/specs/2026-07-19-ai-gateway-completion-design.md).
const GOOGLE_MODEL_BY_TIER: Record<Tier, string> = {
  small: "gemini-flash-lite-latest",
  large: "gemini-flash-lite-latest"
};

export class ResolveProviderForCompletionUseCase {
  constructor(private readonly configs: ProviderConfigRepository) {}

  async execute(workspaceId: string, tier: Tier): Promise<ResolvedProvider> {
    const configs = await this.configs.listByWorkspace(workspaceId);
    const active = configs.find((config) => config.status === "Active");

    if (!active || (active.provider === "Google" && active.keyMode === "Platform")) {
      return this.platformDefault(tier);
    }

    if (active.provider !== "Google") {
      throw new NoCompletionAdapterError(active.provider);
    }

    const credential = await this.configs.getDecryptedCredential(active.id, workspaceId);
    if (!credential) {
      throw new Error(`Expected a stored credential for BringYourOwn config ${active.id}.`);
    }

    return { provider: "Google", model: GOOGLE_MODEL_BY_TIER[tier], credential, keyMode: "BringYourOwn" };
  }

  private platformDefault(tier: Tier): ResolvedProvider {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }
    return { provider: "Google", model: GOOGLE_MODEL_BY_TIER[tier], credential: apiKey, keyMode: "Platform" };
  }
}
