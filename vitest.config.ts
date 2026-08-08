import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Isolation tests create and delete real rows; running files in parallel
    // would let one suite's teardown race another's fixtures.
    fileParallelism: false,
    include: ["tests/**/*.test.ts"],
  },
});
