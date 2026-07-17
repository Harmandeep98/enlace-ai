import type { FaqEntry } from "../domain/entities.js";
import type { FaqRepository } from "./ports.js";

export interface ListFaqsInput {
  workspaceId: string;
}

export class ListFaqsUseCase {
  constructor(private readonly faqs: FaqRepository) {}

  async execute(input: ListFaqsInput): Promise<FaqEntry[]> {
    return this.faqs.listByWorkspace(input.workspaceId);
  }
}
