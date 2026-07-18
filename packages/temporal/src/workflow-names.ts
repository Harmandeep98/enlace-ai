// Workflow names as string constants, not function references — a client caller (e.g.
// apps/api) starts a workflow by name without importing apps/worker's implementation code,
// which would violate the package-never-imports-an-app rule (docs/03-monorepo-structure.md §6).
export const WORKFLOW_NAMES = {
  HEALTH_CHECK: "healthCheckWorkflow",
  KNOWLEDGE_SYNC: "knowledgeSyncWorkflow"
} as const;
