import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "./key-cipher.js";

const MASTER_KEY = randomBytes(32).toString("base64");

describe("key-cipher", () => {
  it("round-trips plaintext through encrypt and decrypt", () => {
    const ciphertext = encrypt("sk-real-looking-secret-key", MASTER_KEY);
    const plaintext = decrypt(ciphertext, MASTER_KEY);
    expect(plaintext).toBe("sk-real-looking-secret-key");
  });

  it("produces a different ciphertext each call (random IV)", () => {
    const first = encrypt("same-input", MASTER_KEY);
    const second = encrypt("same-input", MASTER_KEY);
    expect(first).not.toBe(second);
  });

  it("throws when the ciphertext has been tampered with", () => {
    const ciphertext = encrypt("sk-real-looking-secret-key", MASTER_KEY);
    const [iv, payload, authTag] = ciphertext.split(":");
    const tampered = `${iv}:${payload?.slice(0, -4)}abcd:${authTag}`;
    expect(() => decrypt(tampered, MASTER_KEY)).toThrow();
  });

  it("throws when the auth tag has been tampered with", () => {
    const ciphertext = encrypt("sk-real-looking-secret-key", MASTER_KEY);
    const [iv, payload, authTag] = ciphertext.split(":");
    const tampered = `${iv}:${payload}:${authTag?.slice(0, -4)}abcd`;
    expect(() => decrypt(tampered, MASTER_KEY)).toThrow();
  });
});
