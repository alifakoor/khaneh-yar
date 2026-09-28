import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    testTimeout: 20_000,
    // The first run downloads a mongod binary for mongodb-memory-server.
    hookTimeout: 180_000,
  },
});
