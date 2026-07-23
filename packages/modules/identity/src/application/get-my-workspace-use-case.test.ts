import { describe, expect, it } from "vitest";
import type { Membership } from "../domain/entities.js";
import type { CreateMembershipInput, MembershipRepository } from "./ports.js";
import { GetMyWorkspaceUseCase } from "./get-my-workspace-use-case.js";

class FakeMembershipRepository implements MembershipRepository {
  constructor(private readonly workspaceId: string | undefined) {}

  async create(_input: CreateMembershipInput): Promise<Membership> {
    throw new Error("not used in this test");
  }

  async findActiveOwnerEmail(): Promise<string | undefined> {
    return undefined;
  }

  async findByUserAndWorkspace(): Promise<Membership | undefined> {
    throw new Error("not used in this test");
  }

  async findFirstActiveWorkspaceIdForUser(): Promise<string | undefined> {
    return this.workspaceId;
  }
}

describe("GetMyWorkspaceUseCase", () => {
  it("returns the user's workspaceId when a membership exists", async () => {
    const useCase = new GetMyWorkspaceUseCase(new FakeMembershipRepository("workspace-1"));

    await expect(useCase.execute("user-1")).resolves.toBe("workspace-1");
  });

  it("returns undefined when the user has no membership", async () => {
    const useCase = new GetMyWorkspaceUseCase(new FakeMembershipRepository(undefined));

    await expect(useCase.execute("user-1")).resolves.toBeUndefined();
  });
});
