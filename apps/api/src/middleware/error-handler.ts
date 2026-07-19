// docs/07-api-design.md §5 — one error-mapping table, not per-route ad hoc handling.
import type { Context } from "hono";
import { DomainError } from "@enlace/shared";
import { WorkspaceSlugTakenError } from "@enlace/identity";
import { ConversationNotFoundError, ConversationNotOpenError, EscalationReasonRequiredError } from "@enlace/conversations";
import {
  CredentialRequiredError,
  PlatformKeyModeRequiresGoogleError,
  ProviderConfigNotFoundError,
  ProviderKeyValidationFailedError
} from "@enlace/ai-gateway";
import type { AppEnv } from "../types.js";

const errorStatusMap = new Map<new (...args: never[]) => DomainError, number>([
  [WorkspaceSlugTakenError, 409],
  [ConversationNotOpenError, 409],
  [EscalationReasonRequiredError, 400],
  [ConversationNotFoundError, 404],
  [PlatformKeyModeRequiresGoogleError, 400],
  [CredentialRequiredError, 400],
  [ProviderKeyValidationFailedError, 400],
  [ProviderConfigNotFoundError, 404]
]);

export function mapDomainErrorToResponse(error: unknown, c: Context<AppEnv>) {
  if (error instanceof DomainError) {
    const status = [...errorStatusMap.entries()].find(([ctor]) => error instanceof ctor)?.[1] ?? 400;
    return c.json({ error: { code: error.code, message: error.message, requestId: c.get("requestId") } }, status as 400 | 404 | 409);
  }
  return c.json({ error: { code: "internal_error", message: "Something went wrong.", requestId: c.get("requestId") } }, 500);
}
