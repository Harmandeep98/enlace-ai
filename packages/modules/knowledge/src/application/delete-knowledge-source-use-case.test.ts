import { describe, expect, it } from "vitest";
import { KnowledgeSourceNotFoundError } from "../domain/errors.js";
import type { KnowledgeSource } from "../domain/entities.js";
import type { CreateKnowledgeSourceInput, KnowledgeSourceRepository } from "./ports.js";
import { DeleteKnowledgeSourceUseCase } from "./delete-knowledge-source-use-case.js";

class FakeKnowledgeSourceRepository implements KnowledgeSourceRepository {
  constructor(private readonly existing: boolean) {}

  async create(_input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    throw new Error("not used in this test");
  }

  async listByWorkspace(): Promise<KnowledgeSource[]> {
    throw new Error("not used in this test");
  }

  async delete(): Promise<boolean> {
    return this.existing;
  }

  async updateSyncStatus(): Promise<void> {
    throw new Error("not used in this test");
  }
}

describe("DeleteKnowledgeSourceUseCase", () => {
  it("deletes an existing source", async () => {
    const useCase = new DeleteKnowledgeSourceUseCase(new FakeKnowledgeSourceRepository(true));

    await expect(useCase.execute({ sourceId: "source-1", workspaceId: "workspace-1" })).resolves.toBeUndefined();
  });

  it("throws KnowledgeSourceNotFoundError when nothing was deleted", async () => {
    const useCase = new DeleteKnowledgeSourceUseCase(new FakeKnowledgeSourceRepository(false));

    await expect(useCase.execute({ sourceId: "missing", workspaceId: "workspace-1" })).rejects.toThrow(
      KnowledgeSourceNotFoundError
    );
  });
});
