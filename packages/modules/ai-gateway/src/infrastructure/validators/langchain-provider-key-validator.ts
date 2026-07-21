import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOllama } from "@langchain/ollama";
import { ChatOpenAI } from "@langchain/openai";
import type { ProviderKeyValidator } from "../../application/ports.js";
import type { Provider } from "../../domain/entities.js";

const VALIDATION_PROMPT = "ping";

// One trivial invoke() per provider proves a submitted credential (or, for Ollama, host URL)
// actually authenticates — before ConfigureProviderUseCase ever persists it. The same
// per-provider chat model construction is reused for real completions once each provider's
// adapter gets built (docs/superpowers/specs/2026-07-19-provider-config-design.md).
export class LangChainProviderKeyValidator implements ProviderKeyValidator {
  async validate(provider: Provider, credential: string): Promise<boolean> {
    try {
      const model = this.buildModel(provider, credential);
      await model.invoke(VALIDATION_PROMPT);
      return true;
    } catch {
      return false;
    }
  }

  private buildModel(provider: Provider, credential: string) {
    switch (provider) {
      case "Google":
        // gemini-2.0-flash has zero free-tier quota on this project's key (confirmed via a real
        // 429 with limit: 0) — gemini-flash-lite-latest is the model this account can actually call.
        return new ChatGoogleGenerativeAI({ apiKey: credential, model: "gemini-flash-lite-latest" });
      case "OpenAI":
        return new ChatOpenAI({ apiKey: credential, model: "gpt-4o-mini" });
      case "Anthropic":
        return new ChatAnthropic({ apiKey: credential, model: "claude-haiku-4-5-20251001" });
      case "OpenRouter":
        return new ChatOpenAI({
          apiKey: credential,
          model: "openai/gpt-4o-mini",
          configuration: { baseURL: "https://openrouter.ai/api/v1" }
        });
      case "Ollama":
        return new ChatOllama({ baseUrl: credential, model: "llama3.2" });
    }
  }
}
