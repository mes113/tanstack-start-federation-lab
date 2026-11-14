import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { tanstackStartModuleFederation } from "@module-federation/tanstack/rsbuild";
import { createHash } from "node:crypto";

export default defineConfig({
  source: {
    define: {
      "process.env.LAB_RELEASE": JSON.stringify(
        process.env.LAB_RELEASE ?? "v1",
      ),
    },
  },
  dev: { lazyCompilation: false },
  server: {
    host: "127.0.0.1",
    port: 3006,
    strictPort: true,
    cors: { origin: ["http://127.0.0.1:3005"] },
  },
  plugins: [
    pluginReact(),
    tanstackStart({
      serverFns: {
        base: "/_federation/orders/_serverFn",
        generateFunctionId: ({ filename, functionName }) =>
          process.env.LAB_FUNCTION_EPOCH
            ? `${process.env.LAB_FUNCTION_EPOCH}_${createHash("sha256").update(`${filename}:${functionName}`).digest("hex").slice(0, 24)}`
            : undefined,
      },
    }),
    ...tanstackStartModuleFederation({
      federation: {
        name: "orders",
        dev: { disableDynamicRemoteTypeHints: true },
        dts: { generateTypes: { abortOnError: true }, consumeTypes: false },
        exposes: { "./OrdersPanel": "./src/components/OrdersPanel.tsx" },
      },
      server: true,
    }),
  ],
});
