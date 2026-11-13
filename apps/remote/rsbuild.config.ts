import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { tanstackStartModuleFederation } from "@module-federation/tanstack/rsbuild";

export default defineConfig({
  dev: { lazyCompilation: false },
  server: {
    host: "127.0.0.1",
    port: 3004,
    strictPort: true,
    cors: { origin: ["http://127.0.0.1:3005"] },
  },
  plugins: [
    pluginReact(),
    tanstackStart({ serverFns: { base: "/_federation/catalog/_serverFn" } }),
    ...tanstackStartModuleFederation({
      federation: {
        name: "catalog",
        dev: { disableDynamicRemoteTypeHints: true },
        dts: { generateTypes: { abortOnError: true }, consumeTypes: false },
        // Only the UI is public. Its server functions remain private imports.
        exposes: { "./ServerPanel": "./src/components/ServerPanel.tsx" },
      },
      server: true,
    }),
  ],
});
