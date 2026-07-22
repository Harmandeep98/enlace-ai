import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SlackAdapter } from "./slack-adapter.js";

describe("SlackAdapter", () => {
  let server: Server;
  let url: string;
  let receivedBodies: string[] = [];
  let responseStatus = 200;

  beforeEach(async () => {
    receivedBodies = [];
    responseStatus = 200;

    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        receivedBodies.push(body);
        res.writeHead(responseStatus, { "Content-Type": "text/plain" });
        res.end("ok");
      });
    });
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (address && typeof address === "object") {
      url = `http://127.0.0.1:${address.port}`;
    }
  });

  afterEach(() => {
    server.close();
  });

  const adapter = new SlackAdapter();

  it("has type Slack", () => {
    expect(adapter.type).toBe("Slack");
  });

  it("getToolSchemas always returns an empty array — Slack never participates in tool-calling", () => {
    expect(adapter.getToolSchemas({ webhookUrl: "https://hooks.slack.com/services/anything" })).toEqual([]);
  });

  it("invokeTool throws — Slack should never be asked to invoke a tool", async () => {
    await expect(adapter.invokeTool("anything", {}, { webhookUrl: url }, undefined)).rejects.toThrow(
      "Slack does not support tool invocation."
    );
  });

  it("validateConfig posts a real connection-test message and passes on a 2xx response", async () => {
    const result = await adapter.validateConfig({ webhookUrl: url }, undefined);

    expect(result.valid).toBe(true);
    expect(receivedBodies).toHaveLength(1);
    expect(JSON.parse(receivedBodies[0]!)).toEqual({ text: "Enlace Ai connected to this Slack channel." });
  });

  it("validateConfig fails against a non-2xx-responding server", async () => {
    responseStatus = 500;

    const result = await adapter.validateConfig({ webhookUrl: url }, undefined);

    expect(result.valid).toBe(false);
  });

  it("notify posts the given text to the configured webhook URL", async () => {
    await adapter.notify("Conversation escalated.", { webhookUrl: url });

    expect(receivedBodies).toHaveLength(1);
    expect(JSON.parse(receivedBodies[0]!)).toEqual({ text: "Conversation escalated." });
  });

  it("notify throws on a non-2xx response", async () => {
    responseStatus = 500;

    await expect(adapter.notify("Conversation escalated.", { webhookUrl: url })).rejects.toThrow();
  });
});
