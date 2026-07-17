// docs/05-domain-model.md §3 — domain-facing types, independent of the Prisma schema shape.
export type WorkspaceStatus = "Active" | "Suspended" | "PendingDeletion" | "Deleted";
export type PlanTier = "Free" | "Starter" | "Growth";
export type MembershipRole = "Owner" | "Admin" | "Agent";
export type MembershipStatus = "Invited" | "Active" | "Removed";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  planTier: PlanTier;
  status: WorkspaceStatus;
}

export interface Membership {
  id: string;
  workspaceId: string;
  userId: string;
  role: MembershipRole;
  status: MembershipStatus;
}
