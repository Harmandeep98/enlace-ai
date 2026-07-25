import { describe, expect, it } from "vitest";
import { KnowledgeSourceNotFoundError } from "../domain/errors.js";
import type { KnowledgeSource } from "../domain/entities.js";
import type { CreateKnowledgeSourceInput, DocumentChunkInput, DocumentChunkRepository, KnowledgeSourceRepository } from "./ports.js";
import { GetKnowledgeSourceUseCase } from "./get-knowledge-source-use-case.js";

class FakeKnowledgeSourceRepository implements KnowledgeSourceRepository {
  constructor(private readonly source: KnowledgeSource | undefined) {}
  async create(_input: CreateKnowledgeSourceInput): Promise<KnowledgeSource> {
    throw new Error("not used in this test");
  }
  async listByWorkspace(): Promise<KnowledgeSource[]> {
    throw new Error("not used in this test");
  }
  async findById(): Promise<KnowledgeSource | undefined> {
    return this.source;
  }
  async delete(): Promise<boolean> {
    throw new Error("not used in this test");
  }
  async updateSyncStatus(): Promise<void> {
    throw new Error("not used in this test");
  }
}

class FakeDocumentChunkRepository implements DocumentChunkRepository {
  constructor(private readonly count: number) {}
  async insertMany(_workspaceId: string, _sourceId: string, _chunks: DocumentChunkInput[]): Promise<void> {
    throw new Error("not used in this test");
  }
  async findBestMatches(): Promise<{ content: string }[]> {
    throw new Error("not used in this test");
  }
  async countBySource(): Promise<number> {
    return this.count;
  }
}

describe("GetKnowledgeSourceUseCase", () => {
  it("returns the source with its chunk count", async () => {
    const source: KnowledgeSource = {
      id: "source-1",
      workspaceId: "workspace-1",
      type: "Pdf",
      origin: "handbook.pdf",
      syncStatus: "Ready",
      lastSyncedAt: new Date()
    };
    const useCase = new GetKnowledgeSourceUseCase(new FakeKnowledgeSourceRepository(source), new FakeDocumentChunkRepository(4));

    const detail = await useCase.execute({ sourceId: "source-1", workspaceId: "workspace-1" });

    expect(detail).toEqual({ ...source, chunkCount: 4 });
  });

  it("throws KnowledgeSourceNotFoundError when the source doesn't exist", async () => {
    const useCase = new GetKnowledgeSourceUseCase(new FakeKnowledgeSourceRepository(undefined), new FakeDocumentChunkRepository(0));

    await expect(useCase.execute({ sourceId: "missing", workspaceId: "workspace-1" })).rejects.toThrow(
      KnowledgeSourceNotFoundError
    );
  });
});
