import type { FaqEntry } from "../domain/entities.js";

export interface CreateFaqInput {
  workspaceId: string;
  question: string;
  answer: string;
}

export interface FaqRepository {
  create(input: CreateFaqInput): Promise<FaqEntry>;
  listByWorkspace(workspaceId: string): Promise<FaqEntry[]>;
  findBestMatch(workspaceId: string, message: string): Promise<FaqEntry | undefined>;
}

export interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
}

export interface SemanticCacheRepository {
  findBestMatch(workspaceId: string, message: string): Promise<{ answer: string } | undefined>;
  save(workspaceId: string, question: string, answer: string): Promise<void>;
}
