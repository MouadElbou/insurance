import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    root: ".",
    include: ["__tests__/**/*.test.{ts,tsx}"],
    setupFiles: ["__tests__/setup.ts"],
    testTimeout: 10000,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@insurance/shared": path.resolve(__dirname, "../../packages/shared/src"),
    },
  },
});
