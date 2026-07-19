import type { ProviderConfig } from "../domain/entities.js";
import type { ProviderConfigRepository } from "./ports.js";

export class ListProviderConfigsUseCase {
  constructor(private readonly configs: ProviderConfigRepository) {}

  async execute(workspaceId: string): Promise<ProviderConfig[]> {
    return this.configs.listByWorkspace(workspaceId);
  }
}
