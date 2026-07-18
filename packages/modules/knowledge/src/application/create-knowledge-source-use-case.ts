import type { KnowledgeSource } from "../domain/entities.js";
import type { CreateKnowledgeSourceInput, KnowledgeSourceRepository } from "./ports.js";

export class CreateKnowledgeSourceUseCase {
  constructor(private readonly sources: KnowledgeSourceRepository) {}

  async execute(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    return this.sources.create(input);
  }
}
