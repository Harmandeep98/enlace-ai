import { Prisma, prisma } from "@enlace/db";
import { decrypt, encrypt } from "@enlace/shared";
import type { IntegrationConnection, IntegrationType } from "../domain/entities.js";
import type { CreateIntegrationConnectionInput, IntegrationConnectionRepository } from "../application/ports.js";

function masterKey(): string {
  const key = process.env.KEY_ENCRYPTION_SECRET;
  if (!key) {
    throw new Error("KEY_ENCRYPTION_SECRET is not set.");
  }
  return key;
}

function toIntegrationConnection(row: {
  id: string;
  workspaceId: string;
  type: string;
  config: Prisma.JsonValue;
  status: string;
}): IntegrationConnection {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    type: row.type as IntegrationType,
    config: row.config as Record<string, unknown>,
    status: row.status as IntegrationConnection["status"]
  };
}

export class PrismaIntegrationConnectionRepository implements IntegrationConnectionRepository {
  private withTenant<T>(workspaceId: string, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.workspace_id', ${workspaceId}, true)`;
      return fn(tx);
    });
  }

  async create(input: CreateIntegrationConnectionInput): Promise<IntegrationConnection> {
    const encryptedCredential = input.credential ? encrypt(input.credential, masterKey()) : null;
    const row = await this.withTenant(input.workspaceId, (tx) =>
      tx.integrationConnection.create({
        data: {
          workspaceId: input.workspaceId,
          type: input.type,
          config: input.config as Prisma.InputJsonValue,
          encryptedCredential,
          status: "Active"
        }
      })
    );
    return toIntegrationConnection(row);
  }

  async findByWorkspaceAndType(workspaceId: string, type: IntegrationType): Promise<IntegrationConnection | undefined> {
    const row = await this.withTenant(workspaceId, (tx) =>
      tx.integrationConnection.findFirst({ where: { workspaceId, type } })
    );
    return row ? toIntegrationConnection(row) : undefined;
  }

  async getDecryptedCredential(connectionId: string, workspaceId: string): Promise<string | undefined> {
    const row = await this.withTenant(workspaceId, (tx) => tx.integrationConnection.findFirst({ where: { id: connectionId } }));
    if (!row?.encryptedCredential) return undefined;
    return decrypt(row.encryptedCredential, masterKey());
  }
}
