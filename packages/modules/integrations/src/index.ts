// Public surface of the Integrations module (docs/04-folder-structure.md §2).
export type { IntegrationConnection, IntegrationConnectionStatus, IntegrationType, ToolCallRequest, ToolCallResult, ToolSchema } from "./domain/entities.js";
export { DomainError, IntegrationConnectionNotFoundError, IntegrationValidationFailedError, NoAdapterRegisteredError } from "./domain/errors.js";

export type { CreateIntegrationConnectionInput, IntegrationAdapter, IntegrationConnectionRepository, ToolInvocationContext, ZendeskSyncTriggerPort } from "./application/ports.js";
export { CreateIntegrationConnectionUseCase } from "./application/create-integration-connection-use-case.js";
export { InvokeToolUseCase } from "./application/invoke-tool-use-case.js";

export { PrismaIntegrationConnectionRepository } from "./infrastructure/prisma-integration-connection-repository.js";
export { TemporalZendeskSyncTrigger } from "./infrastructure/temporal-zendesk-sync-trigger.js";
export { WebhookAdapter } from "./infrastructure/webhook-adapter.js";
export { ZendeskAdapter } from "./infrastructure/zendesk-adapter.js";
