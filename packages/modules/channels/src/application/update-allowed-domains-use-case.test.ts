import { describe, expect, it } from "vitest";
import { InvalidDomainError } from "../domain/errors.js";
import type { ChannelConnection } from "../domain/entities.js";
import type { ChannelRepository } from "./ports.js";
import { UpdateAllowedDomainsUseCase } from "./update-allowed-domains-use-case.js";

class FakeChannelRepository implements ChannelRepository {
  public updatedWith: string[] | undefined;
  async createDefaultWidget(): Promise<ChannelConnection> {
    throw new Error("not used in this test");
  }
  async findByWorkspace(): Promise<ChannelConnection | undefined> {
    throw new Error("not used in this test");
  }
  async findByPublicKey(): Promise<ChannelConnection | undefined> {
    throw new Error("not used in this test");
  }
  async updateAllowedDomains(workspaceId: string, domains: string[]): Promise<ChannelConnection> {
    this.updatedWith = domains;
    return { id: "channel-1", workspaceId, type: "Widget", publicKey: "wk_live_abc123", allowedDomains: domains };
  }
}

describe("UpdateAllowedDomainsUseCase", () => {
  it("persists a valid list of bare hostnames", async () => {
    const repo = new FakeChannelRepository();
    const useCase = new UpdateAllowedDomainsUseCase(repo);

    const result = await useCase.execute({ workspaceId: "workspace-1", domains: ["example.com", "app.example.com"] });

    expect(result.allowedDomains).toEqual(["example.com", "app.example.com"]);
    expect(repo.updatedWith).toEqual(["example.com", "app.example.com"]);
  });

  it("rejects a domain containing a protocol", async () => {
    const useCase = new UpdateAllowedDomainsUseCase(new FakeChannelRepository());

    await expect(useCase.execute({ workspaceId: "workspace-1", domains: ["https://example.com"] })).rejects.toThrow(
      InvalidDomainError
    );
  });

  it("rejects a domain containing a path", async () => {
    const useCase = new UpdateAllowedDomainsUseCase(new FakeChannelRepository());

    await expect(useCase.execute({ workspaceId: "workspace-1", domains: ["example.com/widget"] })).rejects.toThrow(
      InvalidDomainError
    );
  });

  it("rejects an empty string", async () => {
    const useCase = new UpdateAllowedDomainsUseCase(new FakeChannelRepository());

    await expect(useCase.execute({ workspaceId: "workspace-1", domains: [""] })).rejects.toThrow(InvalidDomainError);
  });
});
