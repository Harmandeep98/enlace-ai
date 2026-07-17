// docs/05-domain-model.md §4 — domain-facing type, independent of the Prisma schema shape.
export type ChannelType = "Widget";

export interface ChannelConnection {
  id: string;
  workspaceId: string;
  type: ChannelType;
}
