import { describe, expect, it } from "vitest";
import { GeminiEmbeddingAdapter } from "./gemini-embedding-adapter.js";

// Hits the real Gemini API (free tier) — skipped without a key, same gating this repo
// already applies to Postgres-dependent tests needing a real local database.
const maybeIt = process.env.GEMINI_API_KEY ? it : it.skip;

describe("GeminiEmbeddingAdapter", () => {
  maybeIt("returns a 768-dimension embedding for a piece of text", async () => {
    const adapter = new GeminiEmbeddingAdapter();

    const embedding = await adapter.embed("What are your business hours?");

    expect(embedding).toHaveLength(768);
    expect(embedding.every((value) => typeof value === "number")).toBe(true);
  });
});
