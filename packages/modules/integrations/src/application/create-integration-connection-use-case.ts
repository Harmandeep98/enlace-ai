import { IntegrationValidationFailedError, NoAdapterRegisteredError } from "../domain/errors.js";
import type { IntegrationConnection, IntegrationType } from "../domain/entities.js";
import type { CreateIntegrationConnectionInput, IntegrationAdapter, IntegrationConnectionRepository } from "./ports.js";

export class CreateIntegrationConnectionUseCase {
  constructor(
    private readonly connections: IntegrationConnectionRepository,
    private readonly adapters: Partial<Record<IntegrationType, IntegrationAdapter>>
  ) {}

  async execute(input: CreateIntegrationConnectionInput): Promise<IntegrationConnection> {
    const adapter = this.adapters[input.type];
    if (!adapter) throw new NoAdapterRegisteredError(input.type);

    const validation = await adapter.validateConfig(input.config, input.credential);
    if (!validation.valid) {
      throw new IntegrationValidationFailedError(validation.error ?? "unknown validation error");
    }

    return this.connections.create(input);
  }
}
