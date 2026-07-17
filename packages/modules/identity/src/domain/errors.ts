// docs/05-domain-model.md §3, docs/20-coding-standards.md §3 (thrown typed errors, not a Result type)
export abstract class DomainError extends Error {
  abstract readonly code: string;
}

export class WorkspaceSlugTakenError extends DomainError {
  readonly code = "workspace_slug_taken";
  constructor(slug: string) {
    super(`Workspace slug "${slug}" is already in use.`);
  }
}
