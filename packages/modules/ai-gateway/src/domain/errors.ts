import { DomainError } from "@enlace/shared";

export { DomainError };

export class PlatformKeyModeRequiresGoogleError extends DomainError {
  readonly code = "platform_key_mode_requires_google";
  constructor() {
    super("Platform key mode is only available for the Google provider.");
  }
}

export class CredentialRequiredError extends DomainError {
  readonly code = "credential_required";
  constructor() {
    super("A credential is required when bringing your own key.");
  }
}

export class ProviderKeyValidationFailedError extends DomainError {
  readonly code = "provider_key_validation_failed";
  constructor(provider: string) {
    super(`Could not validate the provided credential for ${provider}.`);
  }
}

export class ProviderConfigNotFoundError extends DomainError {
  readonly code = "provider_config_not_found";
  constructor() {
    super("Provider config not found.");
  }
}
