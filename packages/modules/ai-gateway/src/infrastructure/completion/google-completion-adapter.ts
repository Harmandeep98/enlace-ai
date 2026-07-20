import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { CheckCostCeilingUseCase } from "../../application/check-cost-ceiling-use-case.js";
import type { RecordUsageUseCase } from "../../application/record-usage-use-case.js";
import type { ResolveProviderForCompletionUseCase } from "../../application/resolve-provider-for-completion-use-case.js";
import type { CompletionChunk, CompletionRequest, CompletionResult } from "../../domain/entities.js";
import { combineConfidence, detectDeflection, detectUsedContext, ESCALATION_CONFIDENCE_THRESHOLD } from "./confidence.js";

// Gemini 2.5 Flash generation pricing, which gemini-flash-latest currently aliases to
// (docs/superpowers/specs/2026-07-19-ai-gateway-completion-design.md) — informational only,
// the cost ceiling itself enforces on raw token count, not this estimate.
const INPUT_RATE_PER_MILLION = 0.3;
const OUTPUT_RATE_PER_MILLION = 2.5;
const CHARS_PER_TOKEN = 4;

const RESPONSE_SCHEMA = z.object({
  answer: z.string().describe("The answer to the customer's question."),
  confidence: z.number().min(0).max(1).describe("Self-rated confidence, 0 to 1, that this answer is well-supported by the given context.")
});

function buildPrompt(request: CompletionRequest): string {
  const contextText = request.context.map((chunk) => chunk.content).join("\n\n");
  const conversation = request.messages.map((message) => `${message.role}: ${message.content}`).join("\n");
  return [
    "Answer the customer's question using ONLY the context provided below.",
    "If the context doesn't contain enough information, say so honestly rather than guessing.",
    "",
    "Context:",
    contextText,
    "",
    "Conversation:",
    conversation
  ].join("\n");
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateCost(tokensIn: number, tokensOut: number): number {
  return (tokensIn / 1_000_000) * INPUT_RATE_PER_MILLION + (tokensOut / 1_000_000) * OUTPUT_RATE_PER_MILLION;
}

export class GoogleCompletionAdapter {
  constructor(
    private readonly resolveProvider: ResolveProviderForCompletionUseCase,
    private readonly checkCostCeiling: CheckCostCeilingUseCase,
    private readonly recordUsage: RecordUsageUseCase
  ) {}

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const resolved = await this.resolveProvider.execute(request.workspaceId, request.tier);
    const model = new ChatGoogleGenerativeAI({ apiKey: resolved.credential, model: resolved.model });
    const structuredModel = model.withStructuredOutput(RESPONSE_SCHEMA);

    const prompt = buildPrompt(request);
    const response = await structuredModel.invoke(prompt);

    const tokensIn = estimateTokens(prompt);
    const tokensOut = estimateTokens(response.answer);
    const usedContext = detectUsedContext(response.answer, request.context);
    const isDeflection = detectDeflection(response.answer);
    const combinedScore = combineConfidence(response.confidence, usedContext, isDeflection);

    if (resolved.keyMode === "Platform") {
      await this.recordUsage.execute(request.workspaceId, tokensIn + tokensOut);
    }

    const result: CompletionResult = {
      content: response.answer,
      confidence: { score: response.confidence, usedContext, isDeflection },
      usage: { tokensIn, tokensOut, estimatedCost: estimateCost(tokensIn, tokensOut) },
      provider: resolved.provider,
      model: resolved.model
    };

    if (request.tier === "small" && combinedScore < ESCALATION_CONFIDENCE_THRESHOLD) {
      const allowed =
        resolved.keyMode === "Platform" ? await this.checkCostCeiling.isLargeTierCallAllowed(request.workspaceId) : true;
      if (allowed) {
        return this.complete({ ...request, tier: "large" });
      }
    }

    return result;
  }

  async *completeStream(request: CompletionRequest): AsyncIterable<CompletionChunk> {
    const resolved = await this.resolveProvider.execute(request.workspaceId, request.tier);
    const model = new ChatGoogleGenerativeAI({ apiKey: resolved.credential, model: resolved.model });
    const prompt = buildPrompt(request);

    let fullContent = "";
    const stream = await model.stream(prompt);
    for await (const chunk of stream) {
      const delta = typeof chunk.content === "string" ? chunk.content : "";
      fullContent += delta;
      yield { contentDelta: delta, done: false };
    }

    const tokensIn = estimateTokens(prompt);
    const tokensOut = estimateTokens(fullContent);
    const usedContext = detectUsedContext(fullContent, request.context);
    const isDeflection = detectDeflection(fullContent);
    // Structured output doesn't stream, so there's no self-reported score here — the
    // structural signal alone stands in for it. No mid-stream escalation retry either: the
    // small-tier tokens are already sent to the caller by the time confidence is known.
    const structuralOnlyScore = usedContext && !isDeflection ? 1 : 0;

    if (resolved.keyMode === "Platform") {
      await this.recordUsage.execute(request.workspaceId, tokensIn + tokensOut);
    }

    const result: CompletionResult = {
      content: fullContent,
      confidence: { score: structuralOnlyScore, usedContext, isDeflection },
      usage: { tokensIn, tokensOut, estimatedCost: estimateCost(tokensIn, tokensOut) },
      provider: resolved.provider,
      model: resolved.model
    };

    yield { contentDelta: "", done: true, result };
  }
}
