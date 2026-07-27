import { describe, expect, it } from "vitest";
import { ChannelNotFoundError, OriginNotAllowedError } from "../domain/errors.js";
import type { ChannelConnection } from "../domain/entities.js";
import type { ChannelRepository } from "./ports.js";
import { VerifyWidgetOriginUseCase } from "./verify-widget-origin-use-case.js";

class FakeChannelRepository implements ChannelRepository {
  constructor(private readonly channel: ChannelConnection | undefined) {}
  async createDefaultWidget(): Promise<ChannelConnection> {
    throw new Error("not used in this test");
  }
  async findByWorkspace(): Promise<ChannelConnection | undefined> {
    throw new Error("not used in this test");
  }
  async findByPublicKey(): Promise<ChannelConnection | undefined> {
    return this.channel;
  }
  async updateAllowedDomains(): Promise<ChannelConnection> {
    throw new Error("not used in this test");
  }
}

const CHANNEL: ChannelConnection = {
  id: "channel-1",
  workspaceId: "workspace-1",
  type: "Widget",
  publicKey: "wk_live_abc123",
  allowedDomains: ["example.com"]
};

describe("VerifyWidgetOriginUseCase", () => {
  it("returns the workspace and channel id for a valid key and an allowed Origin", async () => {
    const useCase = new VerifyWidgetOriginUseCase(new FakeChannelRepository(CHANNEL));

    const result = await useCase.execute({ publicKey: "wk_live_abc123", originHeader: "https://example.com", refererHeader: undefined });

    expect(result).toEqual({ workspaceId: "workspace-1", channelId: "channel-1" });
  });

  it("falls back to the Referer header when Origin is absent", async () => {
    const useCase = new VerifyWidgetOriginUseCase(new FakeChannelRepository(CHANNEL));

    const result = await useCase.execute({
      publicKey: "wk_live_abc123",
      originHeader: undefined,
      refererHeader: "https://example.com/some/page"
    });

    expect(result.workspaceId).toBe("workspace-1");
  });

  it("throws ChannelNotFoundError for an unknown public key", async () => {
    const useCase = new VerifyWidgetOriginUseCase(new FakeChannelRepository(undefined));

    await expect(
      useCase.execute({ publicKey: "wk_live_unknown", originHeader: "https://example.com", refererHeader: undefined })
    ).rejects.toThrow(ChannelNotFoundError);
  });

  it("throws OriginNotAllowedError for a valid key but disallowed origin", async () => {
    const useCase = new VerifyWidgetOriginUseCase(new FakeChannelRepository(CHANNEL));

    await expect(
      useCase.execute({ publicKey: "wk_live_abc123", originHeader: "https://evil.example", refererHeader: undefined })
    ).rejects.toThrow(OriginNotAllowedError);
  });

  it("throws OriginNotAllowedError when neither Origin nor Referer is present", async () => {
    const useCase = new VerifyWidgetOriginUseCase(new FakeChannelRepository(CHANNEL));

    await expect(
      useCase.execute({ publicKey: "wk_live_abc123", originHeader: undefined, refererHeader: undefined })
    ).rejects.toThrow(OriginNotAllowedError);
  });
});
