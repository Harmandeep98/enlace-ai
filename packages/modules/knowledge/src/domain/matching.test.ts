import { describe, expect, it } from "vitest";
import { findBestFaqMatch } from "./matching.js";
import type { FaqEntry } from "./entities.js";

function makeFaq(question: string, answer: string): FaqEntry {
  return { id: question, workspaceId: "workspace-1", question, answer };
}

describe("findBestFaqMatch", () => {
  it("matches when the message shares enough significant words with the question", () => {
    const entries = [makeFaq("What are your business hours", "9am-5pm Mon-Fri.")];

    const match = findBestFaqMatch("What are your business hours", entries);

    expect(match?.answer).toBe("9am-5pm Mon-Fri.");
  });

  it("does not match when no significant words are shared", () => {
    const entries = [makeFaq("What are your business hours", "9am-5pm Mon-Fri.")];

    const match = findBestFaqMatch("Do you ship internationally", entries);

    expect(match).toBeUndefined();
  });

  it("does not match when 2+ words are shared but coverage is below 50% of the question", () => {
    const entries = [makeFaq("How can I return a damaged product for a full refund", "Contact support.")];

    // Shares "damaged" and "refund" (2 of the question's 5 significant words: return, damaged, product, full, refund) — 40% coverage, below the 50% threshold.
    const match = findBestFaqMatch("My item arrived damaged, can I get a refund", entries);

    expect(match).toBeUndefined();
  });

  it("picks the entry with the highest coverage when multiple qualify", () => {
    const entries = [
      makeFaq("What are your shipping rates and options", "See our shipping page."),
      makeFaq("What are your shipping options", "We ship worldwide.")
    ];

    const match = findBestFaqMatch("What are your shipping options", entries);

    expect(match?.answer).toBe("We ship worldwide.");
  });

  it("returns undefined for an empty entries list", () => {
    expect(findBestFaqMatch("What are your business hours", [])).toBeUndefined();
  });

  it("returns undefined when the message has no significant words", () => {
    const entries = [makeFaq("What are your business hours", "9am-5pm Mon-Fri.")];

    expect(findBestFaqMatch("Is it ok", entries)).toBeUndefined();
  });
});
