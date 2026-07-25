import { KnowledgeSourceNotFoundError } from "../domain/errors.js";
import type { KnowledgeSource } from "../domain/entities.js";
import type { DocumentChunkRepository, KnowledgeSourceRepository } from "./ports.js";

export interface GetKnowledgeSourceInput {
  sourceId: string;
  workspaceId: string;
}

export type KnowledgeSourceDetail = KnowledgeSource & { chunkCount: number };

export class GetKnowledgeSourceUseCase {
  constructor(
    private readonly sources: KnowledgeSourceRepository,
    private readonly chunks: DocumentChunkRepository
  ) {}

  async execute(input: GetKnowledgeSourceInput): Promise<KnowledgeSourceDetail> {
    const source = await this.sources.findById(input.sourceId, input.workspaceId);
    if (!source) throw new KnowledgeSourceNotFoundError(input.sourceId);
    const chunkCount = await this.chunks.countBySource(input.sourceId, input.workspaceId);
    return { ...source, chunkCount };
  }
}
