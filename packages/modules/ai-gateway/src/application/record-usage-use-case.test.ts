import { describe, expect, it } from "vitest";
import type { CostCeilingRepository } from "./ports.js";
import { RecordUsageUseCase } from "./record-usage-use-case.js";

class FakeCostCeilingRepository implements CostCeilingRepository {
  added: { workspaceId: string; tokens: number }[] = [];
  async getTokensSpentThisPeriod(): Promise<number> {
    return 0;
  }
  async addTokens(workspaceId: string, tokens: number): Promise<void> {
    this.added.push({ workspaceId, tokens });
  }
}

describe("RecordUsageUseCase", () => {
  it("adds the given token count for the workspace", async () => {
    const repo = new FakeCostCeilingRepository();
    const useCase = new RecordUsageUseCase(repo);

    await useCase.execute("ws-1", 500);

    expect(repo.added).toEqual([{ workspaceId: "ws-1", tokens: 500 }]);
  });
});
