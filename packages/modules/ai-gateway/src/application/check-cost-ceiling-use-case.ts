import type { CostCeilingRepository } from "./ports.js";

export const PLATFORM_MONTHLY_TOKEN_CEILING = 1_000_000;

export class CheckCostCeilingUseCase {
  constructor(private readonly costCeiling: CostCeilingRepository) {}

  async isLargeTierCallAllowed(workspaceId: string): Promise<boolean> {
    const tokensSpent = await this.costCeiling.getTokensSpentThisPeriod(workspaceId);
    return tokensSpent < PLATFORM_MONTHLY_TOKEN_CEILING;
  }
}
