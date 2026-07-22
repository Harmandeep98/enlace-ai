// Public surface of the Contracts package (docs/03-monorepo-structure.md §3) — the only
// thing apps/web and apps/widget ever import from the backend side of this monorepo.
export { signUpSchema } from "./identity.js";
export type { SignUpRequest } from "./identity.js";
