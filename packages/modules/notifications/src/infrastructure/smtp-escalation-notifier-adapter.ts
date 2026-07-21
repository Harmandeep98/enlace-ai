import nodemailer from "nodemailer";
import type { MembershipRepository } from "@enlace/identity";

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

export class SmtpEscalationNotifierAdapter {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly config: SmtpConfig
  ) {}

  async notify(input: { workspaceId: string; conversationId: string; reason: string }): Promise<void> {
    const ownerEmail = await this.memberships.findActiveOwnerEmail(input.workspaceId);
    if (!ownerEmail) return;

    const transport = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      auth: { user: this.config.user, pass: this.config.pass }
    });

    await transport.sendMail({
      from: this.config.from,
      to: ownerEmail,
      subject: `Conversation escalated — ${input.reason}`,
      text: [
        "A conversation needs your attention.",
        "",
        `Conversation ID: ${input.conversationId}`,
        `Workspace ID: ${input.workspaceId}`,
        `Reason: ${input.reason}`,
        `Time: ${new Date().toISOString()}`
      ].join("\n")
    });
  }
}
