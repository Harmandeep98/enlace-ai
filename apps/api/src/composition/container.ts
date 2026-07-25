// docs/04-folder-structure.md §3 — the one place in apps/api allowed to import infrastructure directly.
import {
  BetterAuthAdapter,
  GetMyWorkspaceUseCase,
  PrismaMembershipRepository,
  PrismaWorkspaceRepository,
  SignUpUseCase,
  VerifyWorkspaceMembershipUseCase
} from "@enlace/identity";
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
  DeleteFaqUseCase,
  DeleteKnowledgeSourceUseCase,
  GetKnowledgeSourceUseCase,
  ListFaqsUseCase,
  ListKnowledgeSourcesUseCase,
  PrismaDocumentChunkRepository,
  PrismaFaqRepository,
  PrismaKnowledgeSourceRepository,
  PrismaSemanticCacheRepository,
  S3FileStorageAdapter,
  TemporalIngestionTrigger,
  UploadKnowledgeSourceUseCase
} from "@enlace/knowledge";
import {
  AddMessageUseCase,
  ConversationEventBus,
  EscalateConversationUseCase,
  GetConversationUseCase,
  IncomingMessageUseCase,
  ListConversationsUseCase,
  PrismaConversationRepository,
  StartConversationUseCase
} from "@enlace/conversations";
import { CompositeEscalationNotifier, SmtpEscalationNotifierAdapter } from "@enlace/notifications";
import type { SlackNotifierPort } from "@enlace/notifications";
import {
  CreateIntegrationConnectionUseCase,
  InvokeToolUseCase,
  PrismaIntegrationConnectionRepository,
  SlackAdapter,
  TemporalZendeskSyncTrigger,
  WebhookAdapter,
  ZendeskAdapter
} from "@enlace/integrations";

function buildContainer() {
  const workspaceRepository = new PrismaWorkspaceRepository();
  const membershipRepository = new PrismaMembershipRepository();
  const verifyWorkspaceMembershipUseCase = new VerifyWorkspaceMembershipUseCase(membershipRepository);
  const smtpEscalationNotifier = new SmtpEscalationNotifierAdapter(membershipRepository, {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.SMTP_FROM ?? ""
  });
  const slackAdapter = new SlackAdapter();
  const authPort = new BetterAuthAdapter();
  const channelRepository = new PrismaChannelRepository();
  const conversationRepository = new PrismaConversationRepository();
  const conversationEventBus = new ConversationEventBus();
  const faqRepository = new PrismaFaqRepository();
  const knowledgeSourceRepository = new PrismaKnowledgeSourceRepository();
  const ingestionTrigger = new TemporalIngestionTrigger();
  const fileStorage = new S3FileStorageAdapter();
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
  const integrationConnectionRepository = new PrismaIntegrationConnectionRepository();
  const integrationAdapters = { Webhook: new WebhookAdapter(), Zendesk: new ZendeskAdapter(), Slack: slackAdapter };

  async function resolveSlackNotifier(workspaceId: string): Promise<SlackNotifierPort | undefined> {
    const connection = await integrationConnectionRepository.findByWorkspaceAndType(workspaceId, "Slack");
    if (!connection || connection.status !== "Active") return undefined;
    return { notify: (text: string) => slackAdapter.notify(text, connection.config) };
  }

  const escalationNotifier = new CompositeEscalationNotifier(smtpEscalationNotifier, resolveSlackNotifier);
  const escalateConversationUseCase = new EscalateConversationUseCase(conversationRepository, escalationNotifier);
  const zendeskSyncTrigger = new TemporalZendeskSyncTrigger();
  const createIntegrationConnectionUseCase = new CreateIntegrationConnectionUseCase(integrationConnectionRepository, integrationAdapters, zendeskSyncTrigger);
  const invokeToolUseCase = new InvokeToolUseCase(integrationConnectionRepository, integrationAdapters);

  return {
    signUpUseCase: new SignUpUseCase(workspaceRepository, membershipRepository, authPort, channelRepository),
    getMyWorkspaceUseCase: new GetMyWorkspaceUseCase(membershipRepository),
    startConversationUseCase,
    addMessageUseCase,
    escalateConversationUseCase,
    getConversationUseCase: new GetConversationUseCase(conversationRepository),
    listConversationsUseCase: new ListConversationsUseCase(conversationRepository),
    conversationEventBus,
    conversationRepository,
    createFaqUseCase: new CreateFaqUseCase(faqRepository),
    listFaqsUseCase: new ListFaqsUseCase(faqRepository),
    createKnowledgeSourceUseCase: new CreateKnowledgeSourceUseCase(knowledgeSourceRepository, ingestionTrigger),
    listKnowledgeSourcesUseCase: new ListKnowledgeSourcesUseCase(knowledgeSourceRepository),
    deleteKnowledgeSourceUseCase: new DeleteKnowledgeSourceUseCase(knowledgeSourceRepository),
    deleteFaqUseCase: new DeleteFaqUseCase(faqRepository),
    uploadKnowledgeSourceUseCase: new UploadKnowledgeSourceUseCase(knowledgeSourceRepository, fileStorage, ingestionTrigger),
    getKnowledgeSourceUseCase: new GetKnowledgeSourceUseCase(knowledgeSourceRepository, documentChunkRepository),
    createIntegrationConnectionUseCase,
    verifyWorkspaceMembershipUseCase,
    incomingMessageUseCase: new IncomingMessageUseCase(
      startConversationUseCase,
      addMessageUseCase,
      conversationRepository,
      faqRepository,
      semanticCacheRepository,
      documentChunkRepository,
      completionAdapter,
      escalateConversationUseCase,
      invokeToolUseCase
    ),
    configureProviderUseCase: new ConfigureProviderUseCase(providerConfigRepository, providerKeyValidator),
    rotateProviderKeyUseCase: new RotateProviderKeyUseCase(providerConfigRepository, providerKeyValidator),
    disableProviderConfigUseCase: new DisableProviderConfigUseCase(providerConfigRepository),
    listProviderConfigsUseCase: new ListProviderConfigsUseCase(providerConfigRepository)
  };
}

export const container = buildContainer();
