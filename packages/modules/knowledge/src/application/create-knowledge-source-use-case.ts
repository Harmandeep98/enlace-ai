import type { KnowledgeSource } from "../domain/entities.js";
import type { CreateKnowledgeSourceInput, IngestionTriggerPort, KnowledgeSourceRepository } from "./ports.js";

export class CreateKnowledgeSourceUseCase {
  constructor(
    private readonly sources: KnowledgeSourceRepository,
    private readonly ingestionTrigger: IngestionTriggerPort
  ) {}

  async execute(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    const source = await this.sources.create(input);
    if (source.type === "Website") {
      await this.ingestionTrigger.startWebsiteSync(source.id, source.workspaceId, source.origin);
    }
    return source;
  }
}
