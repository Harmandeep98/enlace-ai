// Public surface of the Channels module (docs/04-folder-structure.md §2).
export type { ChannelConnection, ChannelType } from "./domain/entities.js";
export { ChannelNotFoundError, OriginNotAllowedError, InvalidDomainError } from "./domain/errors.js";
export type { ChannelRepository } from "./application/ports.js";
export { PrismaChannelRepository } from "./infrastructure/prisma-channel-repository.js";

export { VerifyWidgetOriginUseCase } from "./application/verify-widget-origin-use-case.js";
export type { VerifyWidgetOriginInput, VerifyWidgetOriginResult } from "./application/verify-widget-origin-use-case.js";
export { GetChannelUseCase } from "./application/get-channel-use-case.js";
export type { GetChannelInput } from "./application/get-channel-use-case.js";
export { UpdateAllowedDomainsUseCase } from "./application/update-allowed-domains-use-case.js";
export type { UpdateAllowedDomainsInput } from "./application/update-allowed-domains-use-case.js";
