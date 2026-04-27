import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import electron from "vite-plugin-electron";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: "electron/main.ts",
        vite: {
          // VITE_* env vars are renderer-only at runtime; bake them into the
          // main bundle via define() so getApiUrl() resolves to the Railway
          // URL in packaged builds instead of falling back to localhost.
          define: {
            "process.env.VITE_API_URL": JSON.stringify(process.env.VITE_API_URL ?? ""),
            "process.env.VITE_WS_URL": JSON.stringify(process.env.VITE_WS_URL ?? ""),
          },
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron", "electron-updater", "electron-store"],
            },
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
              output: {
                format: "es",
                entryFileNames: "preload.mjs",
                inlineDynamicImports: true,
              },
            },
          },
        },
      },
    ]),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
