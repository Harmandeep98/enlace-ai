import { describe, expect, it } from "vitest";
import type { CostCeilingRepository } from "./ports.js";
import { CheckCostCeilingUseCase, PLATFORM_MONTHLY_TOKEN_CEILING } from "./check-cost-ceiling-use-case.js";

class FakeCostCeilingRepository implements CostCeilingRepository {
  constructor(private readonly tokensSpent: number) {}
  async getTokensSpentThisPeriod(): Promise<number> {
    return this.tokensSpent;
  }
  async addTokens(): Promise<void> {}
}

describe("CheckCostCeilingUseCase", () => {
  it("allows a large-tier call when under the ceiling", async () => {
    const useCase = new CheckCostCeilingUseCase(new FakeCostCeilingRepository(PLATFORM_MONTHLY_TOKEN_CEILING - 1));
    expect(await useCase.isLargeTierCallAllowed("ws-1")).toBe(true);
  });

  it("blocks a large-tier call at or above the ceiling", async () => {
    const useCase = new CheckCostCeilingUseCase(new FakeCostCeilingRepository(PLATFORM_MONTHLY_TOKEN_CEILING));
    expect(await useCase.isLargeTierCallAllowed("ws-1")).toBe(false);
  });
});
