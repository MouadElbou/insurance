import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: ".",
    include: ["__tests__/**/*.test.ts"],
    setupFiles: ["__tests__/setup.ts"],
    testTimeout: 10000,
    alias: {
      "@insurance/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
