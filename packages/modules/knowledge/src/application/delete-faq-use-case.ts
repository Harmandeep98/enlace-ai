import { FaqNotFoundError } from "../domain/errors.js";
import type { FaqRepository } from "./ports.js";

export interface DeleteFaqInput {
  faqId: string;
  workspaceId: string;
}

export class DeleteFaqUseCase {
  constructor(private readonly faqs: FaqRepository) {}

  async execute(input: DeleteFaqInput): Promise<void> {
    const deleted = await this.faqs.delete(input.faqId, input.workspaceId);
    if (!deleted) throw new FaqNotFoundError(input.faqId);
  }
}
