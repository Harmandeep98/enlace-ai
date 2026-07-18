// docs/superpowers/specs/2026-07-18-semantic-cache-design.md §3 — Gemini's free tier, for $0
// semantic-cache embeddings. text-embedding-004 (the model named in the original spec) has
// since been retired; gemini-embedding-001 is the current model, and its embeddings are
// Matryoshka-style truncatable, so requesting outputDimensionality: 768 gives a valid,
// still-normalized 768-dim vector matching the `vector(768)` schema column, not just a
// truncated/unnormalized slice of a bigger embedding. A real OpenAI adapter is named future
// work, behind the same EmbeddingPort shape Knowledge defines (application/ports.ts).
const GEMINI_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";
const GEMINI_BATCH_EMBED_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents";
const OUTPUT_DIMENSIONALITY = 768;

export class GeminiEmbeddingAdapter {
  async embed(text: string): Promise<number[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const response = await fetch(`${GEMINI_EMBED_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: OUTPUT_DIMENSIONALITY })
    });

    if (!response.ok) {
      throw new Error(`Gemini embedding request failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as { embedding: { values: number[] } };
    return body.embedding.values;
  }

  // docs/16-cost-optimization-strategy.md §5 — batch embedding, not one call per chunk. Also
  // matters for staying under Gemini's free-tier rate limit across a large (up to 500-page)
  // crawl (Website Ingestion spec §2): one call per page instead of one per chunk.
  async embedBatch(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not set.");
    }

    const response = await fetch(`${GEMINI_BATCH_EMBED_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text }] },
          outputDimensionality: OUTPUT_DIMENSIONALITY
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini batch embedding request failed: ${response.status} ${await response.text()}`);
    }

    const body = (await response.json()) as { embeddings: { values: number[] }[] };
    return body.embeddings.map((e) => e.values);
  }
}
