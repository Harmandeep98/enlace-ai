// docs/10-authentication-design.md §2 — Better Auth's SDK is only ever imported here,
// never from application/ or domain/. Swapping providers later is contained to this file.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@enlace/db";
import type { AuthPort, AuthSignUpInput, AuthSignUpResult } from "../application/ports.js";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: { enabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [process.env.WEB_ORIGIN ?? "http://localhost:3000"]
});

export class BetterAuthAdapter implements AuthPort {
  async signUp(input: AuthSignUpInput): Promise<AuthSignUpResult> {
    const result = await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.name }
    });
    return { userId: result.user.id };
  }
}
