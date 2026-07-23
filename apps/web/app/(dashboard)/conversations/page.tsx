"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import { listConversations } from "@/lib/api-client";
import { useConversationEvents } from "@/lib/use-conversation-events";
import { Card } from "@/components/ui/card";
import type { Conversation, ConversationEvent } from "@/lib/types";

const STATUS_STYLES: Record<Conversation["status"], string> = {
  Open: "bg-muted text-muted-foreground",
  AIHandling: "bg-primary/10 text-primary",
  Escalated: "bg-destructive/10 text-destructive",
  Resolved: "bg-muted text-muted-foreground"
};

export default function ConversationsPage() {
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    listConversations(workspaceId).then((result) => {
      if (result.ok) {
        setConversations(result.conversations);
      } else {
        setError(result.message);
      }
    });
  }, [workspaceId]);

  const handleEvent = useCallback((event: ConversationEvent) => {
    if (event.type === "status") {
      setConversations((current) =>
        current.map((c) => (c.id === event.conversationId ? event.conversation : c))
      );
    }
    // A "message" event means this conversation's updatedAt changed on the server too, but
    // the event payload doesn't carry the full conversation — re-fetching the whole list on
    // every message would be wasteful, so the list's own updatedAt/ordering only refreshes
    // on a manual reload for now. Status changes (the more visually important signal) do
    // update live.
  }, []);
  useConversationEvents(workspaceId, handleEvent);

  if (workspaceLoading) return <p className="text-muted-foreground">Loading...</p>;
  if (workspaceError) return <p className="text-destructive">{workspaceError}</p>;
  if (error) return <p className="text-destructive">{error}</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Conversations</h1>
      {conversations.length === 0 && <p className="text-muted-foreground">No conversations yet.</p>}
      <div className="space-y-2">
        {conversations.map((conversation) => (
          <Link key={conversation.id} href={`/conversations/${conversation.id}`}>
            <Card className="flex items-center justify-between p-4 hover:bg-muted/50">
              <div>
                <p className="font-medium">{conversation.customerRef}</p>
                {conversation.escalationReason && (
                  <p className="text-sm text-muted-foreground">Escalated: {conversation.escalationReason}</p>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_STYLES[conversation.status]}`}>
                {conversation.status}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
