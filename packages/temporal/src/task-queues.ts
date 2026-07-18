// Shared between apps/worker (registers a Worker on this queue) and apps/api (starts
// workflows onto it) — the one place both sides agree on the queue name.
export const TASK_QUEUES = {
  DEFAULT: "enlace-default"
} as const;
