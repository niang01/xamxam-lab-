import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    testTimeout: 60000,
    hookTimeout: 60000,
    env: { DB_DRIVER: "pglite-memory", SESSION_SECRET: "test-secret-0123456789-abcdefghij", XX_ADMIN_EMAILS: "admin@test.local" },
  },
});
