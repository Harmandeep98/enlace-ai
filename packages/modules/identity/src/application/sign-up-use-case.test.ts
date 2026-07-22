import { describe, expect, it } from "vitest";
import { WorkspaceSlugTakenError } from "../domain/errors.js";
import type { Membership, Workspace } from "../domain/entities.js";
import type {
  AuthPort,
  AuthSignUpInput,
  ChannelProvisioningPort,
  CreateMembershipInput,
  CreateWorkspaceInput,
  MembershipRepository,
  WorkspaceRepository
} from "./ports.js";
import { SignUpUseCase } from "./sign-up-use-case.js";

class FakeWorkspaceRepository implements WorkspaceRepository {
  public created: CreateWorkspaceInput[] = [];
  constructor(private readonly existingSlugs: Set<string> = new Set()) {}

  async create(input: CreateWorkspaceInput): Promise<Workspace> {
    if (this.existingSlugs.has(input.slug)) throw new WorkspaceSlugTakenError(input.slug);
    this.created.push(input);
    return { id: "workspace-1", name: input.name, slug: input.slug, planTier: input.planTier, status: "Active" };
  }

  async findBySlug(): Promise<Workspace | undefined> {
    return undefined;
  }
}

class FakeMembershipRepository implements MembershipRepository {
  public created: CreateMembershipInput[] = [];

  async create(input: CreateMembershipInput): Promise<Membership> {
    this.created.push(input);
    return { id: "membership-1", workspaceId: input.workspaceId, userId: input.userId, role: input.role, status: "Active" };
  }

  async findActiveOwnerEmail(): Promise<string | undefined> {
    return undefined;
  }

  async findByUserAndWorkspace(): Promise<Membership | undefined> {
    return undefined;
  }
}

class FakeAuthPort implements AuthPort {
  async signUp(_input: AuthSignUpInput) {
    return { userId: "user-1" };
  }
}

class FakeChannelProvisioningPort implements ChannelProvisioningPort {
  public provisionedFor: string[] = [];

  async createDefaultWidget(workspaceId: string) {
    this.provisionedFor.push(workspaceId);
    return { id: "channel-1" };
  }
}

describe("SignUpUseCase", () => {
  it("creates an auth user, a workspace, an Owner membership, and a default widget channel", async () => {
    const workspaceRepo = new FakeWorkspaceRepository();
    const membershipRepo = new FakeMembershipRepository();
    const authPort = new FakeAuthPort();
    const channelPort = new FakeChannelProvisioningPort();
    const useCase = new SignUpUseCase(workspaceRepo, membershipRepo, authPort, channelPort);

    const result = await useCase.execute({
      email: "owner@example.com",
      password: "correct horse battery staple",
      name: "Ada Lovelace",
      workspaceName: "Acme Support Co"
    });

    expect(result.workspace.slug).toBe("acme-support-co");
    expect(workspaceRepo.created).toEqual([{ name: "Acme Support Co", slug: "acme-support-co", planTier: "Free" }]);
    expect(membershipRepo.created).toEqual([{ workspaceId: "workspace-1", userId: "user-1", role: "Owner" }]);
    expect(channelPort.provisionedFor).toEqual(["workspace-1"]);
  });

  it("propagates WorkspaceSlugTakenError when the slug is already used", async () => {
    const workspaceRepo = new FakeWorkspaceRepository(new Set(["acme-support-co"]));
    const membershipRepo = new FakeMembershipRepository();
    const authPort = new FakeAuthPort();
    const channelPort = new FakeChannelProvisioningPort();
    const useCase = new SignUpUseCase(workspaceRepo, membershipRepo, authPort, channelPort);

    await expect(
      useCase.execute({
        email: "owner@example.com",
        password: "correct horse battery staple",
        name: "Ada Lovelace",
        workspaceName: "Acme Support Co"
      })
    ).rejects.toThrow(WorkspaceSlugTakenError);
  });
});
