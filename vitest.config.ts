import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/unit/**/*.test.ts", "tests/api/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["shared/**/*.ts", "server/**/*.ts"],
      exclude: ["server/index-dev.ts", "server/index-prod.ts"],
    },
    // Load .env for DATABASE_URL etc.
    env: { NODE_ENV: "test" },
  },
  resolve: {
    alias: {
      "@shared": path.resolve("shared"),
      "@server": path.resolve("server"),
    },
  },
});
