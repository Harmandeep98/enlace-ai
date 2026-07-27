import { DomainError } from "@enlace/shared";

// Deliberately identical wire message for both — a caller must never be able to tell whether
// their key is wrong or their origin isn't allowlisted (docs/13-widget-architecture.md §5:
// "a mismatched origin gets a generic 'widget not configured for this site' response").
const WIDGET_AUTH_MESSAGE = "Widget not configured for this site.";

export class ChannelNotFoundError extends DomainError {
  readonly code = "channel_not_found";
  constructor() {
    super(WIDGET_AUTH_MESSAGE);
  }
}

export class OriginNotAllowedError extends DomainError {
  readonly code = "origin_not_allowed";
  constructor() {
    super(WIDGET_AUTH_MESSAGE);
  }
}

export class InvalidDomainError extends DomainError {
  readonly code = "invalid_domain";
  constructor(domain: string) {
    super(`"${domain}" is not a valid domain — use a bare hostname like "example.com", no protocol or path.`);
  }
}
