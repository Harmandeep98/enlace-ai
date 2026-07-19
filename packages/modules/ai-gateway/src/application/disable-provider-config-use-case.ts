import { ProviderConfigNotFoundError } from "../domain/errors.js";
import type { ProviderConfigRepository } from "./ports.js";

export class DisableProviderConfigUseCase {
  constructor(private readonly configs: ProviderConfigRepository) {}

  async execute(configId: string, workspaceId: string): Promise<void> {
    const existing = await this.configs.findById(configId, workspaceId);
    if (!existing) {
      throw new ProviderConfigNotFoundError();
    }
    await this.configs.updateStatus(configId, workspaceId, "Disabled");
  }
}
