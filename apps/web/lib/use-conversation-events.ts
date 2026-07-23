"use client";

import { useEffect } from "react";
import type { ConversationEvent } from "@/lib/types";

export function useConversationEvents(workspaceId: string | null, onEvent: (event: ConversationEvent) => void): void {
  useEffect(() => {
    if (!workspaceId) return;

    const source = new EventSource(`${process.env.NEXT_PUBLIC_API_URL}/v1/conversations/events?workspaceId=${workspaceId}`, {
      withCredentials: true
    });
    source.onmessage = (message) => {
      onEvent(JSON.parse(message.data) as ConversationEvent);
    };

    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);
}
