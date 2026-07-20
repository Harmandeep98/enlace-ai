import type { CostCeilingRepository } from "./ports.js";

export class RecordUsageUseCase {
  constructor(private readonly costCeiling: CostCeilingRepository) {}

  async execute(workspaceId: string, tokens: number): Promise<void> {
    await this.costCeiling.addTokens(workspaceId, tokens);
  }
}
