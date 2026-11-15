import { defineConfig } from "@rstest/core";
import { definePlaywrightConfig } from "@rstest/playwright/config";
export default defineConfig({
  extends: definePlaywrightConfig({
    contextOptions: { viewport: { width: 1440, height: 1080 } },
    trace: "retain-on-failure",
  }),
  include: ["tests/**/*.test.ts"],
  exclude: ["tests/federation/**"],
  testEnvironment: "node",
  pool: { maxWorkers: 1 },
  testTimeout: 180_000,
  hookTimeout: 240_000,
  reporters: ["default", ["junit", { outputPath: "test-results/rstest.xml" }]],
});
