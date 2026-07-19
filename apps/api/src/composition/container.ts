// docs/04-folder-structure.md §3 — the one place in apps/api allowed to import infrastructure directly.
import { BetterAuthAdapter, PrismaMembershipRepository, PrismaWorkspaceRepository, SignUpUseCase } from "@enlace/identity";
import { PrismaChannelRepository } from "@enlace/channels";
import {
  ConfigureProviderUseCase,
  DisableProviderConfigUseCase,
  GeminiEmbeddingAdapter,
  LangChainProviderKeyValidator,
  ListProviderConfigsUseCase,
  PrismaProviderConfigRepository,
  RotateProviderKeyUseCase
} from "@enlace/ai-gateway";
import {
  CreateFaqUseCase,
  CreateKnowledgeSourceUseCase,
  ListFaqsUseCase,
  ListKnowledgeSourcesUseCase,
  PrismaFaqRepository,
  PrismaKnowledgeSourceRepository,
  PrismaSemanticCacheRepository,
  TemporalIngestionTrigger
} from "@enlace/knowledge";
import {
  AddMessageUseCase,
  EscalateConversationUseCase,
  GetConversationUseCase,
  IncomingMessageUseCase,
  PrismaConversationRepository,
  StartConversationUseCase
} from "@enlace/conversations";

function buildContainer() {
  const workspaceRepository = new PrismaWorkspaceRepository();
  const membershipRepository = new PrismaMembershipRepository();
  const authPort = new BetterAuthAdapter();
  const channelRepository = new PrismaChannelRepository();
  const conversationRepository = new PrismaConversationRepository();
  const faqRepository = new PrismaFaqRepository();
  const knowledgeSourceRepository = new PrismaKnowledgeSourceRepository();
  const ingestionTrigger = new TemporalIngestionTrigger();
  const embeddingAdapter = new GeminiEmbeddingAdapter();
  const semanticCacheRepository = new PrismaSemanticCacheRepository(embeddingAdapter);
  const providerConfigRepository = new PrismaProviderConfigRepository();
  const providerKeyValidator = new LangChainProviderKeyValidator();

  const startConversationUseCase = new StartConversationUseCase(conversationRepository);
  const addMessageUseCase = new AddMessageUseCase(conversationRepository);

  return {
    signUpUseCase: new SignUpUseCase(workspaceRepository, membershipRepository, authPort, channelRepository),
    startConversationUseCase,
    addMessageUseCase,
    escalateConversationUseCase: new EscalateConversationUseCase(conversationRepository),
    getConversationUseCase: new GetConversationUseCase(conversationRepository),
    createFaqUseCase: new CreateFaqUseCase(faqRepository),
    listFaqsUseCase: new ListFaqsUseCase(faqRepository),
    createKnowledgeSourceUseCase: new CreateKnowledgeSourceUseCase(knowledgeSourceRepository, ingestionTrigger),
    listKnowledgeSourcesUseCase: new ListKnowledgeSourcesUseCase(knowledgeSourceRepository),
    incomingMessageUseCase: new IncomingMessageUseCase(
      startConversationUseCase,
      addMessageUseCase,
      conversationRepository,
      faqRepository,
      semanticCacheRepository
    ),
    configureProviderUseCase: new ConfigureProviderUseCase(providerConfigRepository, providerKeyValidator),
    rotateProviderKeyUseCase: new RotateProviderKeyUseCase(providerConfigRepository, providerKeyValidator),
    disableProviderConfigUseCase: new DisableProviderConfigUseCase(providerConfigRepository),
    listProviderConfigsUseCase: new ListProviderConfigsUseCase(providerConfigRepository)
  };
}

export const container = buildContainer();
