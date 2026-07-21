import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@enlace/db";
import { PrismaMembershipRepository } from "@enlace/identity";
import { SmtpEscalationNotifierAdapter } from "./smtp-escalation-notifier-adapter.js";

// Hits a real SMTP server — skipped without credentials, same gating this repo
// already applies to every other real-external-service test this session.
const maybeIt = process.env.SMTP_HOST ? it : it.skip;

describe("SmtpEscalationNotifierAdapter", () => {
  const membershipRepository = new PrismaMembershipRepository();

  afterEach(async () => {
    await prisma.membership.deleteMany();
    await prisma.workspace.deleteMany();
    await prisma.user.deleteMany();
  });

  it("does nothing when the workspace has no Owner membership", async () => {
    const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
    const adapter = new SmtpEscalationNotifierAdapter(membershipRepository, {
      host: "unused",
      port: 0,
      user: "unused",
      pass: "unused",
      from: "unused"
    });

    await expect(
      adapter.notify({ workspaceId: workspace.id, conversationId: "conversation-1", reason: "LowConfidence" })
    ).resolves.toBeUndefined();
  });

  maybeIt(
    "sends a real escalation email to the workspace's Owner",
    async () => {
      const user = await prisma.user.create({ data: { name: "Ada", email: `${randomUUID()}@example.com` } });
      const workspace = await prisma.workspace.create({ data: { name: "Test Co", slug: `test-${randomUUID()}` } });
      await membershipRepository.create({ workspaceId: workspace.id, userId: user.id, role: "Owner" });

      const adapter = new SmtpEscalationNotifierAdapter(membershipRepository, {
        host: process.env.SMTP_HOST!,
        port: Number(process.env.SMTP_PORT),
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,
        from: process.env.SMTP_FROM!
      });

      await expect(
        adapter.notify({ workspaceId: workspace.id, conversationId: "conversation-1", reason: "LowConfidence" })
      ).resolves.toBeUndefined();
    },
    30000
  );
});
