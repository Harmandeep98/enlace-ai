import { WorkspaceAccessDeniedError } from "../domain/errors.js";
import type { MembershipRepository } from "./ports.js";

export class VerifyWorkspaceMembershipUseCase {
  constructor(private readonly memberships: MembershipRepository) {}

  async execute(userId: string, workspaceId: string): Promise<void> {
    const membership = await this.memberships.findByUserAndWorkspace(workspaceId, userId);
    if (!membership) {
      throw new WorkspaceAccessDeniedError();
    }
  }
}
