import type { Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { FileStoragePort } from "../application/ports.js";

export class S3FileStorageAdapter implements FileStoragePort {
  private readonly client = new S3Client({});
  private readonly bucket = process.env.AWS_S3_KNOWLEDGE_BUCKET ?? "";

  async upload(workspaceId: string, sourceId: string, filename: string, content: Buffer, mimeType: string): Promise<string> {
    const key = `workspaces/${workspaceId}/knowledge-sources/${sourceId}/${filename}`;
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content, ContentType: mimeType }));
    return key;
  }

  async download(ref: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: ref }));
    const stream = result.Body as Readable;
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
