import { toWorkspaceSlug } from "../domain/workspace-slug.js";
import type { Membership, Workspace } from "../domain/entities.js";
import type { AuthPort, ChannelProvisioningPort, MembershipRepository, WorkspaceRepository } from "./ports.js";

export interface SignUpInput {
  email: string;
  password: string;
  name: string;
  workspaceName: string;
}

export interface SignUpResult {
  workspace: Workspace;
  membership: Membership;
  userId: string;
}

// Known limitation: Better Auth's signUp writes outside this use case's own DB
// transaction. If workspace/membership/channel creation fails after the auth user is
// created, the result is an orphaned auth user with no workspace — accepted for v1.
export class SignUpUseCase {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly memberships: MembershipRepository,
    private readonly auth: AuthPort,
    private readonly channels: ChannelProvisioningPort
  ) {}

  async execute(input: SignUpInput): Promise<SignUpResult> {
    const { userId } = await this.auth.signUp({
      email: input.email,
      password: input.password,
      name: input.name
    });

    const workspace = await this.workspaces.create({
      name: input.workspaceName,
      slug: toWorkspaceSlug(input.workspaceName),
      planTier: "Free"
    });

    const membership = await this.memberships.create({
      workspaceId: workspace.id,
      userId,
      role: "Owner"
    });

    await this.channels.createDefaultWidget(workspace.id);

    return { workspace, membership, userId };
  }
}
