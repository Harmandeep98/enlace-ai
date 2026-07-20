import { describe, expect, it } from "vitest";
import type { CostCeilingRepository, ProviderConfigRepository } from "../../application/ports.js";
import type { ProviderConfig } from "../../domain/entities.js";
import { CheckCostCeilingUseCase } from "../../application/check-cost-ceiling-use-case.js";
import { RecordUsageUseCase } from "../../application/record-usage-use-case.js";
import { ResolveProviderForCompletionUseCase } from "../../application/resolve-provider-for-completion-use-case.js";
import { GoogleCompletionAdapter } from "./google-completion-adapter.js";

class FakeProviderConfigRepository implements ProviderConfigRepository {
  async upsert(): Promise<ProviderConfig> {
    throw new Error("not used in this test");
  }
  async listByWorkspace(): Promise<ProviderConfig[]> {
    return [];
  }
  async findById(): Promise<ProviderConfig | undefined> {
    return undefined;
  }
  async updateStatus(): Promise<void> {}
  async rotateCredential(): Promise<ProviderConfig> {
    throw new Error("not used in this test");
  }
  async getDecryptedCredential(): Promise<string | null> {
    return null;
  }
}

class FakeCostCeilingRepository implements CostCeilingRepository {
  tokensAdded = 0;
  async getTokensSpentThisPeriod(): Promise<number> {
    return 0;
  }
  async addTokens(_workspaceId: string, tokens: number): Promise<void> {
    this.tokensAdded += tokens;
  }
}

// Hits the real Gemini API (free tier) — skipped without a key, same gating this repo already
// applies to Postgres-dependent tests and gemini-embedding-adapter.test.ts.
const maybeIt = process.env.GEMINI_API_KEY ? it : it.skip;

describe("GoogleCompletionAdapter", () => {
  function buildAdapter() {
    const providerConfigs = new FakeProviderConfigRepository();
    const costCeiling = new FakeCostCeilingRepository();
    const adapter = new GoogleCompletionAdapter(
      new ResolveProviderForCompletionUseCase(providerConfigs),
      new CheckCostCeilingUseCase(costCeiling),
      new RecordUsageUseCase(costCeiling)
    );
    return { adapter, costCeiling };
  }

  maybeIt("answers a grounded question using the provided context", async () => {
    const { adapter } = buildAdapter();

    const result = await adapter.complete({
      workspaceId: "ws-1",
      messages: [{ role: "user", content: "What are your business hours?" }],
      context: [{ content: "Our business hours are 9am to 5pm, Monday through Friday." }],
      tier: "small"
    });

    expect(result.content.length).toBeGreaterThan(0);
    expect(result.confidence.score).toBeGreaterThanOrEqual(0);
    expect(result.confidence.score).toBeLessThanOrEqual(1);
    expect(result.provider).toBe("Google");
    expect(result.model).toBe("gemini-flash-latest");
    expect(result.usage.tokensIn).toBeGreaterThan(0);
    expect(result.usage.tokensOut).toBeGreaterThan(0);
    expect(result.usage.estimatedCost).toBeGreaterThan(0);
  }, 30000);

  maybeIt("records platform-key usage after a call", async () => {
    const { adapter, costCeiling } = buildAdapter();

    await adapter.complete({
      workspaceId: "ws-1",
      messages: [{ role: "user", content: "What are your business hours?" }],
      context: [{ content: "Our business hours are 9am to 5pm." }],
      tier: "small"
    });

    expect(costCeiling.tokensAdded).toBeGreaterThan(0);
  }, 30000);

  maybeIt("streams content and ends with a final chunk carrying the full result", async () => {
    const { adapter } = buildAdapter();

    const chunks: { contentDelta: string; done: boolean; result?: unknown }[] = [];
    for await (const chunk of adapter.completeStream({
      workspaceId: "ws-1",
      messages: [{ role: "user", content: "What are your business hours?" }],
      context: [{ content: "Our business hours are 9am to 5pm." }],
      tier: "small"
    })) {
      chunks.push(chunk);
    }

    const finalChunk = chunks[chunks.length - 1];
    expect(finalChunk?.done).toBe(true);
    expect(finalChunk?.result).toBeDefined();
    const fullContent = chunks.map((c) => c.contentDelta).join("");
    expect(fullContent.length).toBeGreaterThan(0);
  }, 30000);
});
