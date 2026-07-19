import { describe, expect, it } from "vitest";
import { LangChainProviderKeyValidator } from "./langchain-provider-key-validator.js";

// Google uses the real free-tier key already in .env — every other provider test below uses a
// deliberately invalid credential, so this suite spends nothing beyond Google's free tier.
const maybeIt = process.env.GEMINI_API_KEY ? it : it.skip;

describe("LangChainProviderKeyValidator", () => {
  const validator = new LangChainProviderKeyValidator();

  maybeIt("validates a real Google API key", async () => {
    const result = await validator.validate("Google", process.env.GEMINI_API_KEY!);
    expect(result).toBe(true);
  });

  it("rejects an invalid OpenAI key", async () => {
    const result = await validator.validate("OpenAI", "sk-invalid-test-key");
    expect(result).toBe(false);
  });

  it("rejects an invalid Anthropic key", async () => {
    const result = await validator.validate("Anthropic", "sk-ant-invalid-test-key");
    expect(result).toBe(false);
  });

  it("rejects an invalid OpenRouter key", async () => {
    const result = await validator.validate("OpenRouter", "sk-or-invalid-test-key");
    expect(result).toBe(false);
  });

  it("rejects an unreachable Ollama host", async () => {
    const result = await validator.validate("Ollama", "http://localhost:1");
    expect(result).toBe(false);
  });
});
