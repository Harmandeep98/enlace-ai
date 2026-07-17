// Public surface of the Knowledge module (docs/04-folder-structure.md §2).
export type { FaqEntry } from "./domain/entities.js";
export { findBestFaqMatch } from "./domain/matching.js";

export type { CreateFaqInput, FaqRepository } from "./application/ports.js";
export { CreateFaqUseCase } from "./application/create-faq-use-case.js";
export { ListFaqsUseCase } from "./application/list-faqs-use-case.js";
export type { ListFaqsInput } from "./application/list-faqs-use-case.js";

export { PrismaFaqRepository } from "./infrastructure/prisma-faq-repository.js";
