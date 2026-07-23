import type { MembershipRepository } from "./ports.js";

export class GetMyWorkspaceUseCase {
  constructor(private readonly memberships: MembershipRepository) {}

  async execute(userId: string): Promise<string | undefined> {
    return this.memberships.findFirstActiveWorkspaceIdForUser(userId);
  }
}
