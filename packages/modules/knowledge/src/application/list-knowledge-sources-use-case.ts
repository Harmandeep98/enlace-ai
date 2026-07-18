import type { KnowledgeSource } from "../domain/entities.js";
import type { KnowledgeSourceRepository } from "./ports.js";

export interface ListKnowledgeSourcesInput {
  workspaceId: string;
}

export class ListKnowledgeSourcesUseCase {
  constructor(private readonly sources: KnowledgeSourceRepository) {}

  async execute(input: ListKnowledgeSourcesInput): Promise<KnowledgeSource[]> {
    return this.sources.listByWorkspace(input.workspaceId);
  }
}
