import type { ChannelConnection } from "../domain/entities.js";

export interface ChannelRepository {
  createDefaultWidget(workspaceId: string): Promise<ChannelConnection>;
}
