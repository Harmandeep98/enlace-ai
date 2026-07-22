import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import type { ToolDefinition } from "@langchain/core/language_models/base";
import type { CheckCostCeilingUseCase } from "../../application/check-cost-ceiling-use-case.js";
import type { RecordUsageUseCase } from "../../application/record-usage-use-case.js";
import type { ResolveProviderForCompletionUseCase } from "../../application/resolve-provider-for-completion-use-case.js";
import type { CompletionChunk, CompletionRequest, CompletionResult } from "../../domain/entities.js";
import { combineConfidence, detectDeflection, detectUsedContext, ESCALATION_CONFIDENCE_THRESHOLD } from "./confidence.js";

// Gemini 2.5 Flash generation pricing, which gemini-flash-lite-latest currently aliases to
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

function buildMessages(request: CompletionRequest) {
  const contextText = request.context.map((chunk) => chunk.content).join("\n\n");
  const systemText = [
    "Answer the customer's question using ONLY the context provided below, or by calling an available tool if the context doesn't have what you need.",
    "If neither the context nor a tool call can answer the question, say so honestly rather than guessing.",
    "",
    "Context:",
    contextText
  ].join("\n");

  const messages: (SystemMessage | HumanMessage | AIMessage | ToolMessage)[] = [new SystemMessage(systemText)];
  for (const message of request.messages) {
    messages.push(message.role === "user" ? new HumanMessage(message.content) : new AIMessage(message.content));
  }
  for (const turn of request.priorToolExchanges ?? []) {
    const signatures = Object.fromEntries(
      turn.toolCalls.filter((tc) => tc.thoughtSignature).map((tc) => [tc.id, tc.thoughtSignature])
    );
    messages.push(
      new AIMessage({
        content: "",
        tool_calls: turn.toolCalls.map((tc) => ({ id: tc.id, name: tc.name, args: tc.args })),
        additional_kwargs:
          Object.keys(signatures).length > 0 ? { __gemini_function_call_thought_signatures__: signatures } : undefined
      })
    );
    for (const result of turn.results) {
      messages.push(new ToolMessage({ tool_call_id: result.id, content: result.content }));
    }
  }
  return messages;
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

  private async completeWithTools(
    request: CompletionRequest,
    resolved: { credential: string; model: string; provider: CompletionResult["provider"]; keyMode: string }
  ): Promise<CompletionResult> {
    const model = new ChatGoogleGenerativeAI({ apiKey: resolved.credential, model: resolved.model });
    const toolDefinitions: ToolDefinition[] = request.tools!.map((tool) => ({
      type: "function",
      function: { name: tool.name, description: tool.description, parameters: tool.parameters }
    }));
    const messages = buildMessages(request);
    const response = await model.bindTools(toolDefinitions).invoke(messages);

    const promptText = messages.map((m) => (typeof m.content === "string" ? m.content : "")).join("\n");
    const tokensIn = estimateTokens(promptText);

    if (response.tool_calls && response.tool_calls.length > 0) {
      const thoughtSignatures = (response.additional_kwargs?.__gemini_function_call_thought_signatures__ ?? {}) as Record<
        string,
        string
      >;
      const toolCalls = response.tool_calls.map((tc) => {
        const id = tc.id ?? randomUUID();
        return { id, name: tc.name, args: tc.args, thoughtSignature: thoughtSignatures[id] };
      });
      const tokensOut = estimateTokens(JSON.stringify(toolCalls));
      if (resolved.keyMode === "Platform") {
        await this.recordUsage.execute(request.workspaceId, tokensIn + tokensOut);
      }
      return {
        content: "",
        // Placeholder confidence: never meant to be evaluated for escalation — a tool-call
        // round is never a final answer. Callers must check `toolCalls` before `confidence`.
        confidence: { score: 1, usedContext: false, isDeflection: false },
        usage: { tokensIn, tokensOut, estimatedCost: estimateCost(tokensIn, tokensOut) },
        provider: resolved.provider,
        model: resolved.model,
        toolCalls
      };
    }

    const content = typeof response.content === "string" ? response.content : "";
    const tokensOut = estimateTokens(content);
    const usedContext = detectUsedContext(content, request.context);
    const isDeflection = detectDeflection(content);
    if (resolved.keyMode === "Platform") {
      await this.recordUsage.execute(request.workspaceId, tokensIn + tokensOut);
    }
    return {
      content,
      // No self-reported score exists on this path (no withStructuredOutput) — same
      // structural-only fallback already used in completeStream below.
      confidence: { score: usedContext && !isDeflection ? 1 : 0, usedContext, isDeflection },
      usage: { tokensIn, tokensOut, estimatedCost: estimateCost(tokensIn, tokensOut) },
      provider: resolved.provider,
      model: resolved.model
    };
  }

  async complete(request: CompletionRequest): Promise<CompletionResult> {
    const resolved = await this.resolveProvider.execute(request.workspaceId, request.tier);

    if (request.tools && request.tools.length > 0) {
      return this.completeWithTools(request, resolved);
    }

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
