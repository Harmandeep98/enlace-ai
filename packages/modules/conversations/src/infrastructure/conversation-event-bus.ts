import { EventEmitter } from "node:events";
import type { Conversation, Message } from "../domain/entities.js";

export type ConversationEvent =
  | { type: "message"; conversationId: string; message: Message }
  | { type: "status"; conversationId: string; conversation: Conversation }
  | { type: "reply-chunk"; conversationId: string; delta: string }
  | { type: "reply-done"; conversationId: string; message: Message };

export class ConversationEventBus {
  // Each workspaceId is its own event name on this single shared emitter — unrelated to
  // Node's default 10-listener-per-event warning, but several browser tabs open on the
  // same workspace could plausibly exceed it, so it's disabled here rather than tuned.
  private readonly emitter = new EventEmitter({ captureRejections: false }).setMaxListeners(0);

  emit(workspaceId: string, event: ConversationEvent): void {
    this.emitter.emit(workspaceId, event);
  }

  subscribe(workspaceId: string, listener: (event: ConversationEvent) => void): () => void {
    this.emitter.on(workspaceId, listener);
    return () => this.emitter.off(workspaceId, listener);
  }
}
