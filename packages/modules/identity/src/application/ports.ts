// docs/10-authentication-design.md §2 — AuthPort keeps Better Auth out of application/domain code.
// docs/05-domain-model.md §3 — repository ports, implemented by Prisma in infrastructure (Task 8).
import type { Membership, MembershipRole, PlanTier, Workspace } from "../domain/entities.js";

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  planTier: PlanTier;
}

export interface WorkspaceRepository {
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  findBySlug(slug: string): Promise<Workspace | undefined>;
}

export interface CreateMembershipInput {
  workspaceId: string;
  userId: string;
  role: MembershipRole;
}

export interface MembershipRepository {
  create(input: CreateMembershipInput): Promise<Membership>;
}

export interface AuthSignUpInput {
  email: string;
  password: string;
  name: string;
}

export interface AuthSignUpResult {
  userId: string;
}

export interface AuthPort {
  signUp(input: AuthSignUpInput): Promise<AuthSignUpResult>;
}

// Identity only needs "a channel got created" — it does not need Channels' own
// ChannelConnection type, so this port is intentionally minimal and Identity has
// no dependency on @enlace/channels. The composition root (apps/api) is the only
// place that knows PrismaChannelRepository satisfies this port structurally.
export interface ChannelProvisioningPort {
  createDefaultWidget(workspaceId: string): Promise<{ id: string }>;
}
