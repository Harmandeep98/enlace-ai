import type { ProviderConfig } from "../domain/entities.js";
import { ProviderConfigNotFoundError, ProviderKeyValidationFailedError } from "../domain/errors.js";
import type { ProviderConfigRepository, ProviderKeyValidator, RotateProviderKeyInput } from "./ports.js";

export class RotateProviderKeyUseCase {
  constructor(
    private readonly configs: ProviderConfigRepository,
    private readonly validator: ProviderKeyValidator
  ) {}

  async execute(input: RotateProviderKeyInput): Promise<ProviderConfig> {
    const existing = await this.configs.findById(input.configId, input.workspaceId);
    if (!existing) {
      throw new ProviderConfigNotFoundError();
    }

    const isValid = await this.validator.validate(existing.provider, input.credential);
    if (!isValid) {
      throw new ProviderKeyValidationFailedError(existing.provider);
    }

    return this.configs.rotateCredential(input.configId, input.workspaceId, input.credential);
  }
}
