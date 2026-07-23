"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { getConversation, sendMessage, escalateConversation } from "@/lib/api-client";
import { useConversationEvents } from "@/lib/use-conversation-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Conversation, ConversationEvent, Message } from "@/lib/types";

export default function ConversationDetailPage() {
  const params = useParams<{ id: string }>();
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!workspaceId) return;
    getConversation(params.id, workspaceId)
      .then((result) => {
        if (result.ok) {
          setConversation(result.conversation);
          setMessages(result.messages);
        } else {
          setError(result.message);
        }
      })
      .catch(() => setError("Could not reach the server."));
  }, [workspaceId, params.id]);

  const handleEvent = useCallback(
    (event: ConversationEvent) => {
      if (event.conversationId !== params.id) return;
      if (event.type === "message") {
        setMessages((current) => [...current, event.message]);
      } else {
        setConversation(event.conversation);
      }
    },
    [params.id]
  );
  useConversationEvents(workspaceId, handleEvent);

  async function handleReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!workspaceId || !reply.trim()) return;
    setSending(true);
    const result = await sendMessage(params.id, workspaceId, reply);
    setSending(false);
    if (result.ok) {
      setReply("");
    } else {
      setError(result.message);
    }
  }

  async function handleEscalate() {
    if (!workspaceId) return;
    const result = await escalateConversation(params.id, workspaceId, "CustomerRequest");
    if (!result.ok) setError(result.message);
  }

  if (workspaceLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (workspaceError) return <p className="text-destructive">{workspaceError}</p>;
  if (error) return <p className="text-destructive">{error}</p>;
  if (!conversation) return <p className="text-muted-foreground">Loading conversation...</p>;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{conversation.customerRef}</h1>
        {conversation.status !== "Resolved" && (
          <Button variant="outline" size="sm" onClick={handleEscalate}>
            Escalate
          </Button>
        )}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-border bg-background p-4">
        {messages.map((message) => (
          <div key={message.id} className={message.sender === "Customer" ? "text-left" : "text-right"}>
            <span
              className={
                message.sender === "Customer"
                  ? "inline-block rounded-lg bg-muted px-3 py-2 text-sm"
                  : "inline-block rounded-lg bg-primary/10 px-3 py-2 text-sm"
              }
            >
              {message.content}
            </span>
            <p className="mt-1 text-xs text-muted-foreground">{message.sender}</p>
          </div>
        ))}
      </div>
      <form onSubmit={handleReply} className="flex gap-2">
        <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply as yourself..." />
        <Button type="submit" disabled={sending || !reply.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
