// docs/16-cost-optimization-strategy.md §2: FAQ cache is "keyword match, no model call" —
// deliberately not embeddings-based (that's semantic cache, a later slice).
import type { FaqEntry } from "./entities.js";

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "do", "does", "did", "i", "you", "we", "they",
  "to", "for", "of", "in", "on", "at", "and", "or", "my", "your", "our", "it",
  "this", "that", "these", "those", "can", "how", "what", "where", "when", "why",
  "will", "would", "should", "could", "have", "has", "had", "be", "been", "am"
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOPWORDS.has(word))
  );
}

export function findBestFaqMatch(message: string, entries: FaqEntry[]): FaqEntry | undefined {
  const messageTokens = tokenize(message);
  if (messageTokens.size === 0) return undefined;

  let best: { entry: FaqEntry; coverage: number } | undefined;

  for (const entry of entries) {
    const questionTokens = tokenize(entry.question);
    if (questionTokens.size === 0) continue;

    const sharedCount = [...questionTokens].filter((token) => messageTokens.has(token)).length;
    const coverage = sharedCount / questionTokens.size;

    if (sharedCount >= 2 && coverage >= 0.5 && (!best || coverage > best.coverage)) {
      best = { entry, coverage };
    }
  }

  return best?.entry;
}
