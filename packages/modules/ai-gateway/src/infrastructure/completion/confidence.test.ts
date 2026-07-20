import { describe, expect, it } from "vitest";
import type { RetrievedChunk } from "../../domain/entities.js";
import { combineConfidence, detectDeflection, detectUsedContext, ESCALATION_CONFIDENCE_THRESHOLD } from "./confidence.js";

describe("detectDeflection", () => {
  it("detects a common deflection phrase", () => {
    expect(detectDeflection("I'm not sure based on the information provided.")).toBe(true);
  });

  it("returns false for a direct answer", () => {
    expect(detectDeflection("Our business hours are 9am to 5pm, Monday through Friday.")).toBe(false);
  });
});

describe("detectUsedContext", () => {
  const context: RetrievedChunk[] = [{ content: "Our business hours are 9am to 5pm, Monday through Friday." }];

  it("returns true when the answer overlaps meaningfully with the context", () => {
    expect(detectUsedContext("We're open 9am to 5pm, Monday through Friday.", context)).toBe(true);
  });

  it("returns false when there's no context at all", () => {
    expect(detectUsedContext("We're open 9am to 5pm.", [])).toBe(false);
  });

  it("returns false when the answer shares no real overlap with the context", () => {
    expect(detectUsedContext("I like pizza on weekends.", context)).toBe(false);
  });
});

describe("combineConfidence", () => {
  it("averages a high self-reported score with a good structural score", () => {
    expect(combineConfidence(0.8, true, false)).toBeCloseTo(0.9);
  });

  it("averages a high self-reported score with a bad structural score", () => {
    expect(combineConfidence(0.8, false, true)).toBeCloseTo(0.4);
  });

  it("stays below the escalation threshold when both signals are weak", () => {
    expect(combineConfidence(0.2, false, true)).toBeLessThan(ESCALATION_CONFIDENCE_THRESHOLD);
  });
});
