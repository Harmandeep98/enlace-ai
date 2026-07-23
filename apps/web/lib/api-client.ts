import { signUpSchema } from "@enlace/contracts";
import type { SignUpRequest } from "@enlace/contracts";
import type { Conversation, ConversationStatus, Message } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

export async function listConversations(
  workspaceId: string,
  status?: ConversationStatus
): Promise<{ ok: true; conversations: Conversation[] } | { ok: false; message: string }> {
  const query = status ? `?workspaceId=${workspaceId}&status=${status}` : `?workspaceId=${workspaceId}`;
  const res = await fetch(`${API_URL}/v1/conversations${query}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json();
    return { ok: false, message: body.error?.message ?? "Could not load conversations." };
  }
  const body = await res.json();
  return { ok: true, conversations: body.conversations };
}

export async function getConversation(
  conversationId: string,
  workspaceId: string
): Promise<{ ok: true; conversation: Conversation; messages: Message[] } | { ok: false; message: string }> {
  const res = await fetch(`${API_URL}/v1/conversations/${conversationId}?workspaceId=${workspaceId}`, { credentials: "include" });
  if (!res.ok) {
    const body = await res.json();
    return { ok: false, message: body.error?.message ?? "Could not load this conversation." };
  }
  const body = await res.json();
  return { ok: true, conversation: body.conversation, messages: body.messages ?? [] };
}

export async function sendMessage(
  conversationId: string,
  workspaceId: string,
  content: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`${API_URL}/v1/conversations/${conversationId}/messages`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, sender: "Human", content })
  });
  if (!res.ok) {
    const body = await res.json();
    return { ok: false, message: body.error?.message ?? "Could not send that message." };
  }
  return { ok: true };
}

export async function escalateConversation(
  conversationId: string,
  workspaceId: string,
  reason: "CustomerRequest"
): Promise<{ ok: true } | { ok: false; message: string }> {
  const res = await fetch(`${API_URL}/v1/conversations/${conversationId}/escalate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, reason })
  });
  if (!res.ok) {
    const body = await res.json();
    return { ok: false, message: body.error?.message ?? "Could not escalate this conversation." };
  }
  return { ok: true };
}
