import { describe, expect, it } from "vitest";
import type { KnowledgeSource } from "../domain/entities.js";
import type { CreateKnowledgeSourceInput, IngestionTriggerPort, KnowledgeSourceRepository } from "./ports.js";
import { CreateKnowledgeSourceUseCase } from "./create-knowledge-source-use-case.js";

let nextId = 1;

class FakeKnowledgeSourceRepository implements KnowledgeSourceRepository {
  async create(input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    return {
      id: `source-${nextId++}`,
      workspaceId: input.workspaceId,
      type: input.type,
      origin: input.origin,
      syncStatus: "Pending",
      lastSyncedAt: null
    };
  }
  async listByWorkspace(): Promise<KnowledgeSource[]> {
    throw new Error("not used in this test");
  }
  async delete(): Promise<boolean> {
    throw new Error("not used in this test");
  }
  async updateSyncStatus(): Promise<void> {
    throw new Error("not used in this test");
  }
}

class FakeIngestionTriggerPort implements IngestionTriggerPort {
  public startedFor: { sourceId: string; workspaceId: string; origin: string }[] = [];
  async startWebsiteSync(sourceId: string, workspaceId: string, origin: string): Promise<void> {
    this.startedFor.push({ sourceId, workspaceId, origin });
  }
}

describe("CreateKnowledgeSourceUseCase", () => {
  it("starts the website sync workflow when the source type is Website", async () => {
    const sources = new FakeKnowledgeSourceRepository();
    const trigger = new FakeIngestionTriggerPort();
    const useCase = new CreateKnowledgeSourceUseCase(sources, trigger);

    const source = await useCase.execute({ workspaceId: "workspace-1", type: "Website", origin: "https://example.com" });

    expect(trigger.startedFor).toEqual([{ sourceId: source.id, workspaceId: "workspace-1", origin: "https://example.com" }]);
  });

  it("does not start a sync for source types other than Website", async () => {
    const sources = new FakeKnowledgeSourceRepository();
    const trigger = new FakeIngestionTriggerPort();
    const useCase = new CreateKnowledgeSourceUseCase(sources, trigger);

    await useCase.execute({ workspaceId: "workspace-1", type: "Faq", origin: "n/a" });

    expect(trigger.startedFor).toEqual([]);
  });
});
