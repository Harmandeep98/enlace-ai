import type { FaqEntry } from "../domain/entities.js";
import type { CreateFaqInput, FaqRepository } from "./ports.js";

export class CreateFaqUseCase {
  constructor(private readonly faqs: FaqRepository) {}

  async execute(input: CreateFaqInput): Promise<FaqEntry> {
    return this.faqs.create(input);
  }
}
