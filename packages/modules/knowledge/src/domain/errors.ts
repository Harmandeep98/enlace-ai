import { DomainError } from "@enlace/shared";

export class KnowledgeSourceNotFoundError extends DomainError {
  readonly code = "knowledge_source_not_found";
  constructor(sourceId: string) {
    super(`Knowledge source "${sourceId}" was not found.`);
  }
}

export class FaqNotFoundError extends DomainError {
  readonly code = "faq_not_found";
  constructor(faqId: string) {
    super(`FAQ entry "${faqId}" was not found.`);
  }
}
