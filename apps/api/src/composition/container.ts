// docs/04-folder-structure.md §3 — the one place in apps/api allowed to import infrastructure directly.
import { BetterAuthAdapter, PrismaMembershipRepository, PrismaWorkspaceRepository, SignUpUseCase } from "@enlace/identity";
import { PrismaChannelRepository } from "@enlace/channels";
import {
  AddMessageUseCase,
  EscalateConversationUseCase,
  GetConversationUseCase,
  PrismaConversationRepository,
  StartConversationUseCase
} from "@enlace/conversations";

function buildContainer() {
  const workspaceRepository = new PrismaWorkspaceRepository();
  const membershipRepository = new PrismaMembershipRepository();
  const authPort = new BetterAuthAdapter();
  const channelRepository = new PrismaChannelRepository();
  const conversationRepository = new PrismaConversationRepository();

  return {
    signUpUseCase: new SignUpUseCase(workspaceRepository, membershipRepository, authPort, channelRepository),
    startConversationUseCase: new StartConversationUseCase(conversationRepository),
    addMessageUseCase: new AddMessageUseCase(conversationRepository),
    escalateConversationUseCase: new EscalateConversationUseCase(conversationRepository),
    getConversationUseCase: new GetConversationUseCase(conversationRepository)
  };
}

export const container = buildContainer();
