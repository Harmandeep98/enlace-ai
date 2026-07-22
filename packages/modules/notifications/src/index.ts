// Public surface of the Notifications module (docs/04-folder-structure.md §2).
export { SmtpEscalationNotifierAdapter } from "./infrastructure/smtp-escalation-notifier-adapter.js";
export type { SmtpConfig } from "./infrastructure/smtp-escalation-notifier-adapter.js";
export { CompositeEscalationNotifier } from "./infrastructure/composite-escalation-notifier.js";
export type { SlackNotifierPort } from "./infrastructure/composite-escalation-notifier.js";
