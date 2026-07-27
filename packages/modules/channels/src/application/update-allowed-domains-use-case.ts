import { InvalidDomainError } from "../domain/errors.js";
import type { ChannelConnection } from "../domain/entities.js";
import type { ChannelRepository } from "./ports.js";

export interface UpdateAllowedDomainsInput {
  workspaceId: string;
  domains: string[];
}

// Bare hostname only — no protocol, no path, no trailing slash. Deliberately simple (exact
// match against this, no wildcard-subdomain support) per the spec's explicit v1 scope.
const HOSTNAME_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export class UpdateAllowedDomainsUseCase {
  constructor(private readonly channels: ChannelRepository) {}

  async execute(input: UpdateAllowedDomainsInput): Promise<ChannelConnection> {
    for (const domain of input.domains) {
      if (!HOSTNAME_PATTERN.test(domain)) throw new InvalidDomainError(domain);
    }
    return this.channels.updateAllowedDomains(input.workspaceId, input.domains);
  }
}
