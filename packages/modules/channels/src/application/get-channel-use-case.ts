import type { ChannelConnection } from "../domain/entities.js";
import type { ChannelRepository } from "./ports.js";

export interface GetChannelInput {
  workspaceId: string;
}

export class GetChannelUseCase {
  constructor(private readonly channels: ChannelRepository) {}

  async execute(input: GetChannelInput): Promise<ChannelConnection> {
    const channel = await this.channels.findByWorkspace(input.workspaceId);
    // Every workspace gets a default Widget channel at signup (SignUpUseCase) — a missing
    // channel here is a data-integrity invariant violation, not a routine 404 a real user can
    // ever cause, so this is a plain Error (500), not a DomainError.
    if (!channel) throw new Error(`Invariant violated: workspace "${input.workspaceId}" has no channel.`);
    return channel;
  }
}
