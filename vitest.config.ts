import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Server modules import "server-only", which throws outside a React server
    // build. The stub below makes them importable from plain Node tests.
    alias: { "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts") },
  },
})
