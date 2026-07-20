import type { RetrievedChunk } from "../../domain/entities.js";

// docs/superpowers/specs/2026-07-19-ai-gateway-completion-design.md — a tunable default,
// meant to be retuned once real escalation-outcome data exists (docs/11-ai-architecture.md §4).
export const ESCALATION_CONFIDENCE_THRESHOLD = 0.6;

const DEFLECTION_PHRASES = [
  "i don't know",
  "i do not know",
  "i cannot answer",
  "i can't answer",
  "no information",
  "not enough information",
  "i'm not sure",
  "i am not sure"
];

const MIN_WORD_LENGTH = 5;
const MIN_OVERLAP_WORDS = 3;

export function detectDeflection(content: string): boolean {
  const lower = content.toLowerCase();
  return DEFLECTION_PHRASES.some((phrase) => lower.includes(phrase));
}

export function detectUsedContext(content: string, context: RetrievedChunk[]): boolean {
  if (context.length === 0) return false;
  const lowerContent = content.toLowerCase();
  return context.some((chunk) => {
    const words = chunk.content
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length >= MIN_WORD_LENGTH);
    const overlap = words.filter((word) => lowerContent.includes(word));
    return overlap.length >= Math.min(MIN_OVERLAP_WORDS, words.length);
  });
}

export function combineConfidence(selfReportedScore: number, usedContext: boolean, isDeflection: boolean): number {
  const structuralScore = usedContext && !isDeflection ? 1 : 0;
  return (selfReportedScore + structuralScore) / 2;
}
