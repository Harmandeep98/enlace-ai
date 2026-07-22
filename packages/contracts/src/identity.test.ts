import { describe, expect, it } from "vitest";
import { signUpSchema } from "./identity.js";

describe("signUpSchema", () => {
  it("accepts a valid sign-up payload", () => {
    const result = signUpSchema.safeParse({
      email: "ada@example.com",
      password: "correct horse battery staple",
      name: "Ada Lovelace",
      workspaceName: "Acme Support Co"
    });

    expect(result.success).toBe(true);
  });

  it("rejects a short password", () => {
    const result = signUpSchema.safeParse({
      email: "ada@example.com",
      password: "short",
      name: "Ada Lovelace",
      workspaceName: "Acme Support Co"
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = signUpSchema.safeParse({
      email: "not-an-email",
      password: "correct horse battery staple",
      name: "Ada Lovelace",
      workspaceName: "Acme Support Co"
    });

    expect(result.success).toBe(false);
  });
});
