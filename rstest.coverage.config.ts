import { defineConfig } from "@rstest/core";

export default defineConfig({
  include: ["tests/unit.test.ts"],
  testEnvironment: "node",
  coverage: {
    enabled: true,
    provider: "istanbul",
    include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/**/*.{ts,mjs}"],
    exclude: ["**/*.d.ts", "**/routeTree.gen.ts", "**/node_modules/**"],
    reporters: ["text", "html", "lcov", "json-summary"],
    reportsDirectory: "coverage",
    reportOnFailure: true,
    thresholds: {
      "packages/lab-session/*.mjs": {
        statements: 90,
        branches: 85,
        functions: 100,
        lines: 90,
      },
      "apps/orders/src/workspace-store.ts": {
        statements: 90,
        branches: 90,
        functions: 100,
        lines: 90,
      },
      "apps/orders/src/workspace-contract.ts": {
        statements: 80,
        branches: 70,
        functions: 100,
        lines: 80,
      },
    },
  },
});
