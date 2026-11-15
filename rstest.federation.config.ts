import { resolve } from "node:path";
import { createRequire } from "node:module";
import { federation } from "@module-federation/rstest";
import { defineConfig } from "@rstest/core";

const require = createRequire(import.meta.url);

export default defineConfig({
  include: ["tests/federation/**/*.test.ts"],
  testEnvironment: "node",
  env: { LAB_SESSION_SECRET: "rstest-federation-local-fixture" },
  globalSetup: "./tests/federation/setup.ts",
  hookTimeout: 240_000,
  testTimeout: 30_000,
  pool: { maxWorkers: 1 },
  plugins: [
    federation({
      name: "federation_test_host",
      shareStrategy: "loaded-first",
      // Match the app host: external Node React and the containers must share
      // one instance, including the React used by react-dom/server.
      runtimePlugins: [
        require.resolve("@module-federation/tanstack/node-entry-loader"),
      ],
      remoteType: "commonjs",
      remotes: {
        catalog: `commonjs ${resolve("apps/remote/dist/client/remoteEntry.ssr.cjs")}`,
        orders: `commonjs ${resolve("apps/orders/dist/client/remoteEntry.ssr.cjs")}`,
        warehouse: `commonjs ${resolve("apps/react-remote/dist/remoteEntry.ssr.cjs")}`,
      },
      shared: {
        react: { singleton: true, import: false },
        "react-dom": { singleton: true, import: false },
      },
    }),
  ],
});
