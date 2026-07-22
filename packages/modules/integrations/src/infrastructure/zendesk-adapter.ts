import { randomUUID } from "node:crypto";
import type { IntegrationAdapter, ToolInvocationContext } from "../application/ports.js";
import type { ToolCallResult, ToolSchema } from "../domain/entities.js";

interface ZendeskConfig {
  subdomain: string;
  email: string;
}

// Every ticket enlace creates gets this tag, so sync() can find exactly the tickets it's
// responsible for reconciling without touching tickets a human created directly in Zendesk.
const RECONCILIATION_TAG = "enlace_managed";

export function buildCreateTicketBody(args: Record<string, unknown>, conversationId: string) {
  return {
    ticket: {
      subject: args.subject,
      description: args.description,
      external_id: conversationId,
      tags: [RECONCILIATION_TAG]
    }
  };
}

interface ZendeskSearchTicket {
  id: number;
  external_id: string | null;
  status: string;
}

export function parseSolvedExternalIds(searchResponse: { results: ZendeskSearchTicket[] }): string[] {
  return searchResponse.results.filter((t): t is ZendeskSearchTicket & { external_id: string } => Boolean(t.external_id)).map((t) => t.external_id);
}

function baseUrl(config: ZendeskConfig): string {
  return `https://${config.subdomain}.zendesk.com/api/v2`;
}

function authHeader(config: ZendeskConfig, credential: string): string {
  return `Basic ${Buffer.from(`${config.email}/token:${credential}`).toString("base64")}`;
}

export class ZendeskAdapter implements IntegrationAdapter {
  readonly type = "Zendesk" as const;

  getToolSchemas(): ToolSchema[] {
    return [
      {
        name: "create_zendesk_ticket",
        description: "Creates a Zendesk support ticket for an issue this AI cannot resolve on its own.",
        parameters: {
          type: "object",
          properties: {
            subject: { type: "string" },
            description: { type: "string" }
          },
          required: ["subject", "description"]
        }
      }
    ];
  }

  async invokeTool(
    _name: string,
    args: Record<string, unknown>,
    config: unknown,
    credential: string | undefined,
    context?: ToolInvocationContext
  ): Promise<ToolCallResult> {
    if (!context) {
      throw new Error("ZendeskAdapter.invokeTool requires a conversationId context.");
    }
    const zendeskConfig = config as ZendeskConfig;
    const headers = { Authorization: authHeader(zendeskConfig, credential ?? ""), "Content-Type": "application/json" };

    const existingRes = await fetch(`${baseUrl(zendeskConfig)}/tickets.json?external_id=${encodeURIComponent(context.conversationId)}`, {
      headers
    });
    if (existingRes.ok) {
      const existing = (await existingRes.json()) as { tickets: { id: number; status: string }[] };
      const existingTicket = existing.tickets[0];
      if (existingTicket) {
        return { id: randomUUID(), content: JSON.stringify({ ticketId: existingTicket.id, status: existingTicket.status }) };
      }
    }

    const body = buildCreateTicketBody(args, context.conversationId);
    const createRes = await fetch(`${baseUrl(zendeskConfig)}/tickets.json`, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    if (!createRes.ok) {
      throw new Error(`Zendesk ticket creation failed with status ${createRes.status}: ${await createRes.text()}`);
    }
    const created = (await createRes.json()) as { ticket: { id: number; status: string } };
    return { id: randomUUID(), content: JSON.stringify({ ticketId: created.ticket.id, status: created.ticket.status }) };
  }

  async validateConfig(config: unknown, credential: string | undefined): Promise<{ valid: boolean; error?: string }> {
    const zendeskConfig = config as ZendeskConfig;
    try {
      const res = await fetch(`${baseUrl(zendeskConfig)}/users/me.json`, {
        headers: { Authorization: authHeader(zendeskConfig, credential ?? "") }
      });
      if (!res.ok) {
        return { valid: false, error: `Zendesk responded with status ${res.status}: ${await res.text()}` };
      }
      return { valid: true };
    } catch (error) {
      return { valid: false, error: error instanceof Error ? error.message : "Zendesk validation request failed." };
    }
  }

  async sync(config: unknown, credential: string | undefined): Promise<{ resolvedConversationRefs: string[] }> {
    const zendeskConfig = config as ZendeskConfig;
    const query = encodeURIComponent(`type:ticket status:solved tags:${RECONCILIATION_TAG}`);
    const res = await fetch(`${baseUrl(zendeskConfig)}/search.json?query=${query}`, {
      headers: { Authorization: authHeader(zendeskConfig, credential ?? "") }
    });
    if (!res.ok) {
      throw new Error(`Zendesk ticket search failed with status ${res.status}: ${await res.text()}`);
    }
    const searchResponse = (await res.json()) as { results: ZendeskSearchTicket[] };
    return { resolvedConversationRefs: parseSolvedExternalIds(searchResponse) };
  }
}
