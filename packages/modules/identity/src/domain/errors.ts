// docs/05-domain-model.md §3 — DomainError itself now lives in @enlace/shared (Task 1
// of docs/superpowers/plans/2026-07-17-conversations-foundation.md), re-exported here
// so existing imports of DomainError from @enlace/identity keep working.
import { DomainError } from "@enlace/shared";

export { DomainError };

export class WorkspaceSlugTakenError extends DomainError {
  readonly code = "workspace_slug_taken";
  constructor(slug: string) {
    super(`Workspace slug "${slug}" is already in use.`);
  }
}

export class WorkspaceAccessDeniedError extends DomainError {
  readonly code = "workspace_access_denied";
  constructor() {
    super("You do not have access to this workspace.");
  }
}
