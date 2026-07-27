import { ChannelNotFoundError, OriginNotAllowedError } from "../domain/errors.js";
import type { ChannelRepository } from "./ports.js";

export interface VerifyWidgetOriginInput {
  publicKey: string;
  originHeader: string | undefined;
  refererHeader: string | undefined;
}

export interface VerifyWidgetOriginResult {
  workspaceId: string;
  channelId: string;
}

function extractHostname(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).hostname;
  } catch {
    return undefined;
  }
}

export class VerifyWidgetOriginUseCase {
  constructor(private readonly channels: ChannelRepository) {}

  async execute(input: VerifyWidgetOriginInput): Promise<VerifyWidgetOriginResult> {
    const channel = await this.channels.findByPublicKey(input.publicKey);
    if (!channel) throw new ChannelNotFoundError();

    const hostname = extractHostname(input.originHeader) ?? extractHostname(input.refererHeader);
    if (!hostname || !channel.allowedDomains.includes(hostname)) {
      throw new OriginNotAllowedError();
    }

    return { workspaceId: channel.workspaceId, channelId: channel.id };
  }
}
