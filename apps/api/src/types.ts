// Shared Hono context typing — every route/middleware that reads or sets
// c.get("requestId")/c.set("requestId", ...) uses this, so it's typed once.
export interface AppEnv {
  Variables: {
    requestId: string;
    userId: string;
  };
}
