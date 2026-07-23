"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { listConversations } from "@/lib/api-client";
import { useConversationEvents } from "@/lib/use-conversation-events";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationEvent } from "@/lib/types";

const STATUS_STYLES: Record<Conversation["status"], string> = {
  Open: "bg-muted text-muted-foreground",
  AIHandling: "bg-primary/10 text-primary",
  Escalated: "bg-destructive/10 text-destructive",
  Resolved: "bg-muted text-muted-foreground"
};

export default function ConversationsLayout({ children }: { children: React.ReactNode }) {
  const { workspaceId, loading: workspaceLoading, error: workspaceError } = useWorkspace();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!workspaceId) return;
    listConversations(workspaceId)
      .then((result) => {
        if (result.ok) {
          setConversations(result.conversations);
        } else {
          setError(result.message);
        }
      })
      .catch(() => setError("Could not reach the server."));
  }, [workspaceId]);

  const handleEvent = useCallback((event: ConversationEvent) => {
    if (event.type === "status") {
      setConversations((current) => current.map((c) => (c.id === event.conversationId ? event.conversation : c)));
    }
    // A "message" event means this conversation's updatedAt changed on the server too, but
    // the event payload doesn't carry the full conversation — re-fetching the whole list on
    // every message would be wasteful, so the list's own updatedAt/ordering only refreshes
    // on a manual reload for now. Status changes (the more visually important signal) do
    // update live.
  }, []);
  useConversationEvents(workspaceId, handleEvent);

  return (
    <div className="flex h-full gap-6">
      <div className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Conversations</h1>
          <p className="text-xs text-muted-foreground">Live updates as your AI and team handle messages.</p>
        </div>
        {workspaceLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {workspaceError && <p className="text-sm text-destructive">{workspaceError}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!workspaceLoading && !workspaceError && !error && conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-muted-foreground">New conversations will show up here in real time.</p>
          </div>
        )}
        <div className="space-y-1">
          {conversations.map((conversation) => {
            const active = pathname === `/conversations/${conversation.id}`;
            return (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border p-3 transition-colors",
                  active ? "border-primary/30 bg-primary/10" : "border-border bg-background hover:bg-muted/50"
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{conversation.customerRef}</p>
                  {conversation.escalationReason && (
                    <p className="truncate text-xs text-muted-foreground">Escalated: {conversation.escalationReason}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[conversation.status]}`}>
                  {conversation.status}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="min-w-0 flex-1 border-l border-border pl-6">{children}</div>
    </div>
  );
}
