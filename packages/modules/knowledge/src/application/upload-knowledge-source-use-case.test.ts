import { describe, expect, it } from "vitest";
import type { KnowledgeSource } from "../domain/entities.js";
import type { CreateKnowledgeSourceInput, FileStoragePort, IngestionTriggerPort, KnowledgeSourceRepository } from "./ports.js";
import { UploadKnowledgeSourceUseCase } from "./upload-knowledge-source-use-case.js";

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
  async findById(): Promise<KnowledgeSource | undefined> {
    throw new Error("not used in this test");
  }
  async delete(): Promise<boolean> {
    throw new Error("not used in this test");
  }
  async updateSyncStatus(): Promise<void> {
    throw new Error("not used in this test");
  }
}

class FakeFileStoragePort implements FileStoragePort {
  public uploaded: { workspaceId: string; sourceId: string; filename: string; mimeType: string }[] = [];
  async upload(workspaceId: string, sourceId: string, filename: string, _content: Buffer, mimeType: string): Promise<string> {
    this.uploaded.push({ workspaceId, sourceId, filename, mimeType });
    return `workspaces/${workspaceId}/knowledge-sources/${sourceId}/${filename}`;
  }
  async download(): Promise<Buffer> {
    throw new Error("not used in this test");
  }
}

class FakeIngestionTriggerPort implements IngestionTriggerPort {
  public startedFor: { sourceId: string; workspaceId: string; storageRef: string; fileType: string }[] = [];
  async startWebsiteSync(): Promise<void> {
    throw new Error("not used in this test");
  }
  async startFileSync(sourceId: string, workspaceId: string, storageRef: string, fileType: string): Promise<void> {
    this.startedFor.push({ sourceId, workspaceId, storageRef, fileType });
  }
}

describe("UploadKnowledgeSourceUseCase", () => {
  it("creates a Pending source, uploads the file, and starts the file sync workflow", async () => {
    const sources = new FakeKnowledgeSourceRepository();
    const storage = new FakeFileStoragePort();
    const trigger = new FakeIngestionTriggerPort();
    const useCase = new UploadKnowledgeSourceUseCase(sources, storage, trigger);
    const content = Buffer.from("Some file content.");

    const source = await useCase.execute({
      workspaceId: "workspace-1",
      type: "Pdf",
      filename: "handbook.pdf",
      content,
      mimeType: "application/pdf"
    });

    expect(source.origin).toBe("handbook.pdf");
    expect(source.syncStatus).toBe("Pending");
    expect(storage.uploaded).toEqual([
      { workspaceId: "workspace-1", sourceId: source.id, filename: "handbook.pdf", mimeType: "application/pdf" }
    ]);
    expect(trigger.startedFor).toEqual([
      {
        sourceId: source.id,
        workspaceId: "workspace-1",
        storageRef: `workspaces/workspace-1/knowledge-sources/${source.id}/handbook.pdf`,
        fileType: "Pdf"
      }
    ]);
  });
});
