import { defineConfig, mergeConfig } from "vitest/config";
import { baseVitestConfig } from "@enlace/config/vitest.base";

export default defineConfig(
  mergeConfig(baseVitestConfig, {
    test: {
      // This package's only tests live under scripts/, not src/ (docs/06-database-design.md §2's
      // RLS coverage check is a script, not app source) — extend the base include, don't replace it.
      include: ["src/**/*.test.ts", "scripts/**/*.test.ts"]
    }
  })
);
