import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: ".",
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 10000,
  },
});
