// Public surface of the Channels module (docs/04-folder-structure.md §2).
export type { ChannelConnection, ChannelType } from "./domain/entities.js";
export { ChannelNotFoundError, OriginNotAllowedError, InvalidDomainError } from "./domain/errors.js";
export type { ChannelRepository } from "./application/ports.js";
export { PrismaChannelRepository } from "./infrastructure/prisma-channel-repository.js";
