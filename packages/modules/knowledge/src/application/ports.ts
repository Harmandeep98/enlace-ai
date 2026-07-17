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
