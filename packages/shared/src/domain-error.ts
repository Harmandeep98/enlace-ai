// docs/20-coding-standards.md §3 — thrown typed errors, not a Result type. Shared base
// class so every module's domain/errors.ts extends the same thing instead of each
// module defining its own (docs/superpowers/specs/2026-07-17-conversations-design.md §7).
export abstract class DomainError extends Error {
  abstract readonly code: string;
}
