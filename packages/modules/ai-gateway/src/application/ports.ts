import type { KeyMode, Provider, ProviderConfig, ProviderConfigStatus } from "../domain/entities.js";

// `credential` is plaintext here — encryption happens inside the repository implementation,
// same boundary as EmbeddingPort computing an embedding before a repository ever sees it
// (packages/modules/knowledge/src/application/ports.ts). null means Platform mode: nothing to
// encrypt, we already own that key.
export interface UpsertProviderConfigInput {
  workspaceId: string;
  provider: Provider;
  keyMode: KeyMode;
  credential: string | null;
}

export interface ProviderConfigRepository {
  upsert(input: UpsertProviderConfigInput): Promise<ProviderConfig>;
  listByWorkspace(workspaceId: string): Promise<ProviderConfig[]>;
  findById(id: string, workspaceId: string): Promise<ProviderConfig | undefined>;
  updateStatus(id: string, workspaceId: string, status: ProviderConfigStatus): Promise<void>;
  rotateCredential(id: string, workspaceId: string, credential: string): Promise<ProviderConfig>;
  getDecryptedCredential(id: string, workspaceId: string): Promise<string | null>;
}

// Proves a submitted credential actually authenticates with that provider, before it's ever
// persisted. `credential` is an API key for every provider except Ollama, where it's a host URL.
export interface ProviderKeyValidator {
  validate(provider: Provider, credential: string): Promise<boolean>;
}

export interface ConfigureProviderInput {
  workspaceId: string;
  provider: Provider;
  keyMode: KeyMode;
  credential?: string;
}

export interface RotateProviderKeyInput {
  configId: string;
  workspaceId: string;
  credential: string;
}

export interface CostCeilingRepository {
  getTokensSpentThisPeriod(workspaceId: string): Promise<number>;
  addTokens(workspaceId: string, tokens: number): Promise<void>;
}
