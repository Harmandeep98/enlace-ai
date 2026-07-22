import { createHmac } from "node:crypto";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WebhookAdapter } from "./webhook-adapter.js";

describe("WebhookAdapter", () => {
  let server: Server;
  let url: string;
  let receivedBodies: string[] = [];
  let receivedSignatures: string[] = [];
  let responseStatus = 200;
  let responseBody = "ok";

  beforeEach(async () => {
    receivedBodies = [];
    receivedSignatures = [];
    responseStatus = 200;
    responseBody = "ok";

    server = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        receivedBodies.push(body);
        receivedSignatures.push(req.headers["x-enlace-signature"] as string);
        res.writeHead(responseStatus, { "Content-Type": "text/plain" });
        res.end(responseBody);
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

  const adapter = new WebhookAdapter();
  const config = { url: "", toolName: "get_order_status", toolDescription: "Look up an order's status", toolParameters: { type: "object", properties: { orderId: { type: "string" } } } };

  it("returns a ToolSchema built from the connection's config", () => {
    const schemas = adapter.getToolSchemas({ ...config, url });

    expect(schemas).toEqual([
      { name: "get_order_status", description: "Look up an order's status", parameters: config.toolParameters }
    ]);
  });

  it("invokeTool posts a correctly signed payload and returns the response body", async () => {
    const credential = "hmac-secret-123";

    const result = await adapter.invokeTool("get_order_status", { orderId: "12345" }, { ...config, url }, credential);

    expect(receivedBodies).toHaveLength(1);
    const expectedBody = JSON.stringify({ name: "get_order_status", args: { orderId: "12345" } });
    expect(receivedBodies[0]).toBe(expectedBody);
    const expectedSignature = createHmac("sha256", credential).update(expectedBody).digest("hex");
    expect(receivedSignatures[0]).toBe(expectedSignature);
    expect(result.content).toBe("ok");
  });

  it("invokeTool throws on a non-2xx response", async () => {
    responseStatus = 500;
    responseBody = "server error";

    await expect(adapter.invokeTool("get_order_status", { orderId: "12345" }, { ...config, url }, "secret")).rejects.toThrow();
  });

  it("validateConfig passes against a 2xx-responding server", async () => {
    const result = await adapter.validateConfig({ ...config, url }, "secret");

    expect(result.valid).toBe(true);
  });

  it("validateConfig fails against a 500-responding server", async () => {
    responseStatus = 500;

    const result = await adapter.validateConfig({ ...config, url }, "secret");

    expect(result.valid).toBe(false);
  });
});
