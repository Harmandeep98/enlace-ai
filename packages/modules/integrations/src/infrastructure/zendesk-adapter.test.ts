import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildCreateTicketBody, parseSolvedExternalIds, ZendeskAdapter } from "./zendesk-adapter.js";

describe("buildCreateTicketBody", () => {
  it("builds a ticket body carrying the conversation id as external_id and a fixed reconciliation tag", () => {
    const body = buildCreateTicketBody({ subject: "Order delayed", description: "Customer's order #123 hasn't arrived." }, "conversation-1");

    expect(body).toEqual({
      ticket: {
        subject: "Order delayed",
        description: "Customer's order #123 hasn't arrived.",
        external_id: "conversation-1",
        tags: ["enlace_managed"]
      }
    });
  });
});

describe("parseSolvedExternalIds", () => {
  it("extracts external_id from each solved ticket in a search response, skipping tickets without one", () => {
    const searchResponse = {
      results: [
        { id: 1, external_id: "conversation-1", status: "solved" },
        { id: 2, external_id: null, status: "solved" },
        { id: 3, external_id: "conversation-3", status: "solved" }
      ]
    };

    expect(parseSolvedExternalIds(searchResponse)).toEqual(["conversation-1", "conversation-3"]);
  });

  it("returns an empty array for a search response with no results", () => {
    expect(parseSolvedExternalIds({ results: [] })).toEqual([]);
  });
});

describe("ZendeskAdapter", () => {
  const adapter = new ZendeskAdapter();

  it("has type Zendesk", () => {
    expect(adapter.type).toBe("Zendesk");
  });

  it("getToolSchemas returns a single CreateTicket schema regardless of config", () => {
    const schemas = adapter.getToolSchemas({ subdomain: "acme", email: "agent@acme.com" });

    expect(schemas).toEqual([
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
    ]);
  });

  // Hits the real Zendesk API — skipped without sandbox credentials, same gating this repo
  // already applies to every other real-external-service test this session.
  const maybeIt = process.env.ZENDESK_SUBDOMAIN && process.env.ZENDESK_EMAIL && process.env.ZENDESK_API_KEY ? it : it.skip;
  const config = { subdomain: process.env.ZENDESK_SUBDOMAIN ?? "", email: process.env.ZENDESK_EMAIL ?? "" };
  const credential = process.env.ZENDESK_API_KEY;

  maybeIt(
    "validateConfig passes with real credentials",
    async () => {
      const result = await adapter.validateConfig(config, credential);
      expect(result.valid).toBe(true);
    },
    15000
  );

  maybeIt(
    "invokeTool creates a real ticket, and calling it again with the same conversationId returns the same ticket instead of creating a second one",
    async () => {
      const conversationId = `test-${randomUUID()}`;
      const context = { conversationId };

      const first = await adapter.invokeTool(
        "create_zendesk_ticket",
        { subject: "Test ticket", description: "Created by an automated test." },
        config,
        credential,
        context
      );
      const second = await adapter.invokeTool(
        "create_zendesk_ticket",
        { subject: "Test ticket", description: "Created by an automated test." },
        config,
        credential,
        context
      );

      expect(first.content).toContain("ticketId");
      expect(second.content).toBe(first.content);
    },
    30000
  );
});
