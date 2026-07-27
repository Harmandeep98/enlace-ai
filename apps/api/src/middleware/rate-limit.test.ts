import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit.js";

describe("checkRateLimit", () => {
  it("allows up to the limit within one window, then rejects", () => {
    const key = `test-key-${Math.random()}`;
    const now = 1000;

    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(key, now)).toBe(true);
    }
    expect(checkRateLimit(key, now)).toBe(false);
  });

  it("resets once the window has elapsed", () => {
    const key = `test-key-${Math.random()}`;
    const now = 2000;

    for (let i = 0; i < 30; i++) {
      checkRateLimit(key, now);
    }
    expect(checkRateLimit(key, now)).toBe(false);

    expect(checkRateLimit(key, now + 60_000)).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const now = 3000;
    const keyA = `test-key-a-${Math.random()}`;
    const keyB = `test-key-b-${Math.random()}`;

    for (let i = 0; i < 30; i++) {
      checkRateLimit(keyA, now);
    }
    expect(checkRateLimit(keyA, now)).toBe(false);
    expect(checkRateLimit(keyB, now)).toBe(true);
  });
});
