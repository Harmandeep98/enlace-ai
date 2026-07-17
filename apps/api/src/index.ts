import { serve } from "@hono/node-server";
import { buildApp } from "./server.js";

serve({ fetch: buildApp().fetch, port: 3001 });
console.log("apps/api listening on :3001");
