import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/__tests_e2e__/**"],
    coverage: {
      provider: "v8",
      include: ["src/**/*"],
      exclude: [
        "src/__tests__/**",
        "src/__tests_e2e__/**",
        "src/components/ThreeEarth.tsx",
        "src/components/WebsocketProvider.tsx"
      ],
      reporter: ["text", "json-summary", "html"],
    },
  },
});
