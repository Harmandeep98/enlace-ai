import { KnowledgeSourceNotFoundError } from "../domain/errors.js";
import type { KnowledgeSourceRepository } from "./ports.js";

export interface DeleteKnowledgeSourceInput {
  sourceId: string;
  workspaceId: string;
}

export class DeleteKnowledgeSourceUseCase {
  constructor(private readonly sources: KnowledgeSourceRepository) {}

  async execute(input: DeleteKnowledgeSourceInput): Promise<void> {
    const deleted = await this.sources.delete(input.sourceId, input.workspaceId);
    if (!deleted) throw new KnowledgeSourceNotFoundError(input.sourceId);
  }
}
