import { describe, expect, it } from "vitest";
import type { ChannelConnection } from "../domain/entities.js";
import type { ChannelRepository } from "./ports.js";
import { GetChannelUseCase } from "./get-channel-use-case.js";

class FakeChannelRepository implements ChannelRepository {
  constructor(private readonly channel: ChannelConnection | undefined) {}
  async createDefaultWidget(): Promise<ChannelConnection> {
    throw new Error("not used in this test");
  }
  async findByWorkspace(): Promise<ChannelConnection | undefined> {
    return this.channel;
  }
  async findByPublicKey(): Promise<ChannelConnection | undefined> {
    throw new Error("not used in this test");
  }
  async updateAllowedDomains(): Promise<ChannelConnection> {
    throw new Error("not used in this test");
  }
}

describe("GetChannelUseCase", () => {
  it("returns the workspace's channel", async () => {
    const channel: ChannelConnection = {
      id: "channel-1",
      workspaceId: "workspace-1",
      type: "Widget",
      publicKey: "wk_live_abc123",
      allowedDomains: []
    };
    const useCase = new GetChannelUseCase(new FakeChannelRepository(channel));

    const result = await useCase.execute({ workspaceId: "workspace-1" });

    expect(result).toEqual(channel);
  });

  it("throws when a workspace somehow has no channel (invariant violation, not a routine case)", async () => {
    const useCase = new GetChannelUseCase(new FakeChannelRepository(undefined));

    await expect(useCase.execute({ workspaceId: "workspace-1" })).rejects.toThrow();
  });
});
