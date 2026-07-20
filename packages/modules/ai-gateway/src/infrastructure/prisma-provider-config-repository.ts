import { Prisma, prisma } from "@enlace/db";
import { decrypt, encrypt } from "./crypto/key-cipher.js";
import type { ProviderConfig, ProviderConfigStatus } from "../domain/entities.js";
import type { ProviderConfigRepository, UpsertProviderConfigInput } from "../application/ports.js";

function masterKey(): string {
  const key = process.env.KEY_ENCRYPTION_SECRET;
  if (!key) {
    throw new Error("KEY_ENCRYPTION_SECRET is not set.");
  }
  return key;
}

function toProviderConfig(row: {
  id: string;
  workspaceId: string;
  provider: string;
  keyMode: string;
  status: string;
}): ProviderConfig {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider as ProviderConfig["provider"],
    keyMode: row.keyMode as ProviderConfig["keyMode"],
    status: row.status as ProviderConfigStatus
  };
}

export class PrismaProviderConfigRepository implements ProviderConfigRepository {
  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  async upsert(input: UpsertProviderConfigInput): Promise<ProviderConfig> {
    const encryptedApiKey = input.credential ? encrypt(input.credential, masterKey()) : null;
    const row = await this.withTenant(input.workspaceId, (tx) =>
      tx.providerConfig.upsert({
        where: { workspaceId_provider: { workspaceId: input.workspaceId, provider: input.provider } },
        create: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          keyMode: input.keyMode,
          encryptedApiKey,
          status: "Active"
        },
        update: {
          keyMode: input.keyMode,
          encryptedApiKey,
          status: "Active"
        }
      })
    );
    return toProviderConfig(row);
  }

  async listByWorkspace(workspaceId: string): Promise<ProviderConfig[]> {
    const rows = await this.withTenant(workspaceId, (tx) => tx.providerConfig.findMany({ where: { workspaceId } }));
    return rows.map(toProviderConfig);
  }

  async findById(id: string, workspaceId: string): Promise<ProviderConfig | undefined> {
    const row = await this.withTenant(workspaceId, (tx) => tx.providerConfig.findFirst({ where: { id } }));
    return row ? toProviderConfig(row) : undefined;
  }

  async updateStatus(id: string, workspaceId: string, status: ProviderConfigStatus): Promise<void> {
    await this.withTenant(workspaceId, (tx) => tx.providerConfig.update({ where: { id }, data: { status } }));
  }

  async rotateCredential(id: string, workspaceId: string, credential: string): Promise<ProviderConfig> {
    const encryptedApiKey = encrypt(credential, masterKey());
    const row = await this.withTenant(workspaceId, (tx) =>
      tx.providerConfig.update({ where: { id }, data: { encryptedApiKey } })
    );
    return toProviderConfig(row);
  }

  async getDecryptedCredential(id: string, workspaceId: string): Promise<string | null> {
    const row = await this.withTenant(workspaceId, (tx) => tx.providerConfig.findFirst({ where: { id } }));
    if (!row?.encryptedApiKey) return null;
    return decrypt(row.encryptedApiKey, masterKey());
  }
}
