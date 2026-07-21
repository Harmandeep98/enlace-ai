import { prisma } from "@enlace/db";
import type { Membership } from "../domain/entities.js";
import type { CreateMembershipInput, MembershipRepository } from "../application/ports.js";

export class PrismaMembershipRepository implements MembershipRepository {
  async create(input: CreateMembershipInput): Promise<Membership> {
    // The RLS policy's WITH CHECK (Database Design §2) rejects an insert unless
    // app.workspace_id is set to the row's own workspaceId first. Outside a normal
    // request (tenant middleware sets this per-request), the signup flow creates a
    // workspace's first membership before any request-level tenant context exists —
    // so this repository sets it itself, scoped to a single transaction (SET LOCAL)
    // so it can never leak into another connection's session state.
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${input.workspaceId}, true)`;
      return tx.membership.create({ data: input });
    });
    return { id: row.id, workspaceId: row.workspaceId, userId: row.userId, role: row.role, status: row.status };
  }

  async findActiveOwnerEmail(workspaceId: string): Promise<string | undefined> {
    const row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return tx.membership.findFirst({
        where: { workspaceId, role: "Owner", status: "Active" },
        include: { user: true }
      });
    });
    return row?.user.email;
  }
}
