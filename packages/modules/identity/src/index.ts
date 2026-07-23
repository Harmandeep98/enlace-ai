// Public surface of the Identity & Tenancy module (docs/04-folder-structure.md §2) —
// apps/api and apps/worker import only from here, never reaching into domain/
// internals or infrastructure/ directly except through this file.
export { DomainError, WorkspaceAccessDeniedError, WorkspaceSlugTakenError } from "./domain/errors.js";
export type {
  Membership,
  MembershipRole,
  MembershipStatus,
  PlanTier,
  Workspace,
  WorkspaceStatus
} from "./domain/entities.js";
export { toWorkspaceSlug } from "./domain/workspace-slug.js";

export type {
  AuthPort,
  AuthSignUpInput,
  AuthSignUpResult,
  CreateMembershipInput,
  CreateWorkspaceInput,
  MembershipRepository,
  WorkspaceRepository
} from "./application/ports.js";
export { SignUpUseCase } from "./application/sign-up-use-case.js";
export { VerifyWorkspaceMembershipUseCase } from "./application/verify-workspace-membership-use-case.js";
export { GetMyWorkspaceUseCase } from "./application/get-my-workspace-use-case.js";
export type { SignUpInput, SignUpResult } from "./application/sign-up-use-case.js";

export { auth, BetterAuthAdapter } from "./infrastructure/better-auth-adapter.js";
export { PrismaMembershipRepository } from "./infrastructure/prisma-membership-repository.js";
export { PrismaWorkspaceRepository } from "./infrastructure/prisma-workspace-repository.js";
