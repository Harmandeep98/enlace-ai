// docs/05-domain-model.md §7 — Google added beyond the doc's four providers: it's the only
// one the platform actually has a working, free-tier key for today (docs/superpowers/specs/
// 2026-07-19-provider-config-design.md).
export type Provider = "Google" | "OpenAI" | "Anthropic" | "OpenRouter" | "Ollama";
export type KeyMode = "Platform" | "BringYourOwn";
export type ProviderConfigStatus = "Active" | "Disabled";

export interface ProviderConfig {
  id: string;
  workspaceId: string;
  provider: Provider;
  keyMode: KeyMode;
  status: ProviderConfigStatus;
}

export type Tier = "small" | "large";

export interface RetrievedChunk {
  content: string;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
  // Gemini requires this echoed back verbatim on the next turn's function-call part, or it
  // 400s ("missing thought_signature"). Optional/opaque since only this provider needs it —
  // callers that just relay a ToolCall (Conversations' bounded loop) never need to read it.
  thoughtSignature?: string;
}

export interface ToolExchangeTurn {
  toolCalls: ToolCall[];
  results: { id: string; content: string }[];
}

export interface ConfidenceSignal {
  score: number;
  usedContext: boolean;
  isDeflection: boolean;
}

export interface CompletionUsage {
  tokensIn: number;
  tokensOut: number;
  estimatedCost: number;
}

export interface CompletionRequest {
  workspaceId: string;
  messages: ConversationMessage[];
  context: RetrievedChunk[];
  tier: Tier;
  tools?: ToolSchema[];
  priorToolExchanges?: ToolExchangeTurn[];
}

export interface CompletionResult {
  content: string;
  confidence: ConfidenceSignal;
  usage: CompletionUsage;
  provider: Provider;
  model: string;
  toolCalls?: ToolCall[];
}

export interface CompletionChunk {
  contentDelta: string;
  done: boolean;
  result?: CompletionResult;
}
