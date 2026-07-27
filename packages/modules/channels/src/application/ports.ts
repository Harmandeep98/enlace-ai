import type { ChannelConnection } from "../domain/entities.js";

export interface ChannelRepository {
  createDefaultWidget(workspaceId: string): Promise<ChannelConnection>;
  findByWorkspace(workspaceId: string): Promise<ChannelConnection | undefined>;
  findByPublicKey(publicKey: string): Promise<ChannelConnection | undefined>;
  updateAllowedDomains(workspaceId: string, domains: string[]): Promise<ChannelConnection>;
}
