// Public surface of the AI Gateway module (docs/04-folder-structure.md §2).
export { GeminiEmbeddingAdapter } from "./infrastructure/gemini-embedding-adapter.js";

export type { KeyMode, Provider, ProviderConfig, ProviderConfigStatus } from "./domain/entities.js";
export {
  CredentialRequiredError,
  DomainError,
  PlatformKeyModeRequiresGoogleError,
  ProviderConfigNotFoundError,
  ProviderKeyValidationFailedError
} from "./domain/errors.js";

export type {
  ConfigureProviderInput,
  ProviderConfigRepository,
  ProviderKeyValidator,
  RotateProviderKeyInput,
  UpsertProviderConfigInput
} from "./application/ports.js";
export { ConfigureProviderUseCase } from "./application/configure-provider-use-case.js";
export { DisableProviderConfigUseCase } from "./application/disable-provider-config-use-case.js";
export { ListProviderConfigsUseCase } from "./application/list-provider-configs-use-case.js";
export { RotateProviderKeyUseCase } from "./application/rotate-provider-key-use-case.js";

export { PrismaProviderConfigRepository } from "./infrastructure/prisma-provider-config-repository.js";
export { LangChainProviderKeyValidator } from "./infrastructure/validators/langchain-provider-key-validator.js";

export type {
  CompletionChunk,
  CompletionRequest,
  CompletionResult,
  CompletionUsage,
  ConfidenceSignal,
  ConversationMessage,
  RetrievedChunk,
  Tier
} from "./domain/entities.js";
export { NoCompletionAdapterError } from "./domain/errors.js";

export type { CostCeilingRepository } from "./application/ports.js";
export { CheckCostCeilingUseCase, PLATFORM_MONTHLY_TOKEN_CEILING } from "./application/check-cost-ceiling-use-case.js";
export { RecordUsageUseCase } from "./application/record-usage-use-case.js";
export { ResolveProviderForCompletionUseCase } from "./application/resolve-provider-for-completion-use-case.js";
export type { ResolvedProvider } from "./application/resolve-provider-for-completion-use-case.js";

export { PrismaCostCeilingRepository } from "./infrastructure/prisma-cost-ceiling-repository.js";
export { GoogleCompletionAdapter } from "./infrastructure/completion/google-completion-adapter.js";
export {
  combineConfidence,
  detectDeflection,
  detectUsedContext,
  ESCALATION_CONFIDENCE_THRESHOLD
} from "./infrastructure/completion/confidence.js";
