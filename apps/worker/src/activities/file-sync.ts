import pdf from "pdf-parse";
import mammoth from "mammoth";
import { GeminiEmbeddingAdapter } from "@enlace/ai-gateway";
import { PrismaDocumentChunkRepository, PrismaKnowledgeSourceRepository, S3FileStorageAdapter } from "@enlace/knowledge";
import type { KnowledgeSourceType, KnowledgeSyncStatus } from "@enlace/knowledge";
import { chunkEmbedAndStore } from "./chunk-and-embed.js";

const knowledgeSources = new PrismaKnowledgeSourceRepository();
const embeddingAdapter = new GeminiEmbeddingAdapter();
const documentChunks = new PrismaDocumentChunkRepository(embeddingAdapter);
const fileStorage = new S3FileStorageAdapter();

export async function markFileSyncStatus(
  sourceId: string,
  workspaceId: string,
  status: KnowledgeSyncStatus,
  lastSyncedAt?: Date
): Promise<void> {
  await knowledgeSources.updateSyncStatus(sourceId, workspaceId, status, lastSyncedAt);
}

// Dispatches to the real per-format library — no LangChain document-loader wrapper, since we
// only need the plain extracted string, not a LangChain Document object (see the plan's
// "One deviation from the approved spec" note).
export async function extractText(content: Buffer, fileType: KnowledgeSourceType): Promise<string> {
  if (fileType === "Pdf") {
    const data = await pdf(content);
    return data.text.trim();
  }
  if (fileType === "Docx") {
    const result = await mammoth.extractRawText({ buffer: content });
    return result.value.trim();
  }
  return content.toString("utf-8").trim();
}

// Never throws for a file-content problem (download failure, unparseable file, empty extracted
// text) — returns { success: false } instead, mirroring ingestPage's contract in knowledge-sync.ts.
export async function ingestFile(
  workspaceId: string,
  sourceId: string,
  storageRef: string,
  fileType: KnowledgeSourceType
): Promise<{ success: boolean }> {
  let text: string;
  try {
    const content = await fileStorage.download(storageRef);
    text = await extractText(content, fileType);
    if (!text) return { success: false };
  } catch {
    return { success: false };
  }

  return chunkEmbedAndStore(embeddingAdapter, documentChunks, workspaceId, sourceId, text);
}

export async function finalizeFileSync(sourceId: string, workspaceId: string, success: boolean): Promise<void> {
  await knowledgeSources.updateSyncStatus(sourceId, workspaceId, success ? "Ready" : "Failed", new Date());
}
