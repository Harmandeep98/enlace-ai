// docs/04-folder-structure.md §3 — the one place in apps/api allowed to import infrastructure directly.
import { BetterAuthAdapter, PrismaMembershipRepository, PrismaWorkspaceRepository, SignUpUseCase } from "@enlace/identity";
import { PrismaChannelRepository } from "@enlace/channels";
import {
  CheckCostCeilingUseCase,
  ConfigureProviderUseCase,
  DisableProviderConfigUseCase,
  GeminiEmbeddingAdapter,
  GoogleCompletionAdapter,
  LangChainProviderKeyValidator,
  ListProviderConfigsUseCase,
  PrismaCostCeilingRepository,
  PrismaProviderConfigRepository,
  RecordUsageUseCase,
  ResolveProviderForCompletionUseCase,
  RotateProviderKeyUseCase
} from "@enlace/ai-gateway";
import {
  CreateFaqUseCase,
  CreateKnowledgeSourceUseCase,
  ListFaqsUseCase,
  ListKnowledgeSourcesUseCase,
  PrismaDocumentChunkRepository,
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
import { SmtpEscalationNotifierAdapter } from "@enlace/notifications";

function buildContainer() {
  const workspaceRepository = new PrismaWorkspaceRepository();
  const membershipRepository = new PrismaMembershipRepository();
  const escalationNotifier = new SmtpEscalationNotifierAdapter(membershipRepository, {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? ""
  });
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
  const documentChunkRepository = new PrismaDocumentChunkRepository(embeddingAdapter);
  const costCeilingRepository = new PrismaCostCeilingRepository();
  const resolveProviderForCompletion = new ResolveProviderForCompletionUseCase(providerConfigRepository);
  const checkCostCeiling = new CheckCostCeilingUseCase(costCeilingRepository);
  const recordUsage = new RecordUsageUseCase(costCeilingRepository);
  const completionAdapter = new GoogleCompletionAdapter(resolveProviderForCompletion, checkCostCeiling, recordUsage);

  const startConversationUseCase = new StartConversationUseCase(conversationRepository);
  const addMessageUseCase = new AddMessageUseCase(conversationRepository);
  const escalateConversationUseCase = new EscalateConversationUseCase(conversationRepository, escalationNotifier);

  return {
    signUpUseCase: new SignUpUseCase(workspaceRepository, membershipRepository, authPort, channelRepository),
    startConversationUseCase,
    addMessageUseCase,
    escalateConversationUseCase,
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
      semanticCacheRepository,
      documentChunkRepository,
      completionAdapter,
      escalateConversationUseCase
    ),
    configureProviderUseCase: new ConfigureProviderUseCase(providerConfigRepository, providerKeyValidator),
    rotateProviderKeyUseCase: new RotateProviderKeyUseCase(providerConfigRepository, providerKeyValidator),
    disableProviderConfigUseCase: new DisableProviderConfigUseCase(providerConfigRepository),
    listProviderConfigsUseCase: new ListProviderConfigsUseCase(providerConfigRepository)
  };
}

export const container = buildContainer();
