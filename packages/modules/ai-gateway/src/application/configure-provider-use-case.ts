import type { ProviderConfig } from "../domain/entities.js";
import { CredentialRequiredError, PlatformKeyModeRequiresGoogleError, ProviderKeyValidationFailedError } from "../domain/errors.js";
import type { ConfigureProviderInput, ProviderConfigRepository, ProviderKeyValidator } from "./ports.js";

export class ConfigureProviderUseCase {
  constructor(
    private readonly configs: ProviderConfigRepository,
    private readonly validator: ProviderKeyValidator
  ) {}

  async execute(input: ConfigureProviderInput): Promise<ProviderConfig> {
    if (input.keyMode === "Platform") {
      if (input.provider !== "Google") {
        throw new PlatformKeyModeRequiresGoogleError();
      }
      return this.configs.upsert({ workspaceId: input.workspaceId, provider: input.provider, keyMode: input.keyMode, credential: null });
    }

    if (!input.credential) {
      throw new CredentialRequiredError();
    }

    const isValid = await this.validator.validate(input.provider, input.credential);
    if (!isValid) {
      throw new ProviderKeyValidationFailedError(input.provider);
    }

    return this.configs.upsert({
      workspaceId: input.workspaceId,
      provider: input.provider,
      keyMode: input.keyMode,
      credential: input.credential
    });
  }
}
