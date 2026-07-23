import { describe, expect, it } from "vitest";
import { WorkspaceAccessDeniedError } from "../domain/errors.js";
import type { Membership } from "../domain/entities.js";
import type { CreateMembershipInput, MembershipRepository } from "./ports.js";
import { VerifyWorkspaceMembershipUseCase } from "./verify-workspace-membership-use-case.js";

class FakeMembershipRepository implements MembershipRepository {
  constructor(private readonly membership: Membership | undefined) {}

  async create(_input: CreateMembershipInput): Promise<Membership> {
    throw new Error("not used in this test");
  }

  async findActiveOwnerEmail(): Promise<string | undefined> {
    return undefined;
  }

  async findByUserAndWorkspace(): Promise<Membership | undefined> {
    return this.membership;
  }

  async findFirstActiveWorkspaceIdForUser(): Promise<string | undefined> {
    return undefined;
  }
}

describe("VerifyWorkspaceMembershipUseCase", () => {
  it("resolves silently when an Active membership exists", async () => {
    const membership: Membership = { id: "membership-1", workspaceId: "ws-1", userId: "user-1", role: "Owner", status: "Active" };
    const useCase = new VerifyWorkspaceMembershipUseCase(new FakeMembershipRepository(membership));

    await expect(useCase.execute("user-1", "ws-1")).resolves.toBeUndefined();
  });

  it("throws WorkspaceAccessDeniedError when no membership exists", async () => {
    const useCase = new VerifyWorkspaceMembershipUseCase(new FakeMembershipRepository(undefined));

    await expect(useCase.execute("user-1", "ws-1")).rejects.toThrow(WorkspaceAccessDeniedError);
  });
});
