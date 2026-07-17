export const baseVitestConfig = {
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests across this monorepo share one real dev Postgres instance
    // (docs/21-testing-strategy.md §3) — running test files in parallel lets one
    // file's cleanup (deleteMany) race another file's still-running test. Sequential
    // file execution trades some speed for correctness here; per-file tests still run
    // in whatever order within a file.
    fileParallelism: false
  }
};
