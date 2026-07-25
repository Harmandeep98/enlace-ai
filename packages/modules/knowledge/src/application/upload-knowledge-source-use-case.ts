import type { KnowledgeSource, KnowledgeSourceType } from "../domain/entities.js";
import type { FileStoragePort, IngestionTriggerPort, KnowledgeSourceRepository } from "./ports.js";

export interface UploadKnowledgeSourceInput {
  workspaceId: string;
  type: KnowledgeSourceType;
  filename: string;
  content: Buffer;
  mimeType: string;
}

export class UploadKnowledgeSourceUseCase {
  constructor(
    private readonly sources: KnowledgeSourceRepository,
    private readonly storage: FileStoragePort,
    private readonly ingestionTrigger: IngestionTriggerPort
  ) {}

  async execute(input: UploadKnowledgeSourceInput): Promise<KnowledgeSource> {
    const source = await this.sources.create({ workspaceId: input.workspaceId, type: input.type, origin: input.filename });
    const storageRef = await this.storage.upload(input.workspaceId, source.id, input.filename, input.content, input.mimeType);
    await this.ingestionTrigger.startFileSync(source.id, input.workspaceId, storageRef, input.type);
    return source;
  }
}
