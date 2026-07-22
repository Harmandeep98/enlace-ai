import { DomainError } from "@enlace/shared";

export { DomainError };

export class IntegrationValidationFailedError extends DomainError {
  readonly code = "integration_validation_failed";
  constructor(reason: string) {
    super(`Could not validate the integration: ${reason}`);
  }
}

export class IntegrationConnectionNotFoundError extends DomainError {
  readonly code = "integration_connection_not_found";
  constructor() {
    super("No integration connection found for this workspace and type.");
  }
}

export class NoAdapterRegisteredError extends DomainError {
  readonly code = "no_adapter_registered";
  constructor(type: string) {
    super(`No integration adapter is registered for type ${type} yet.`);
  }
}
