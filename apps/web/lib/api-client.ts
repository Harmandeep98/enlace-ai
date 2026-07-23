import { signUpSchema } from "@enlace/contracts";
import type { SignUpRequest } from "@enlace/contracts";

export async function signUp(input: SignUpRequest): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.message };
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data)
  });

  if (!res.ok) {
    const body = await res.json();
    return { ok: false, message: body.error?.message ?? "Sign-up failed." };
  }
  return { ok: true };
}

export async function getMyWorkspace(): Promise<{ ok: true; workspaceId: string } | { ok: false; message: string }> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/me`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json();
    return { ok: false, message: body.error?.message ?? "Could not resolve your workspace." };
  }
  const body = await res.json();
  return { ok: true, workspaceId: body.workspaceId };
}
