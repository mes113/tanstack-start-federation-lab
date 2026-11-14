import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStartModuleFederation } from "@module-federation/tanstack/rsbuild";

export default defineConfig({
  dev: { lazyCompilation: false },
  server: {
    host: "127.0.0.1",
    port: 3007,
    strictPort: true,
    cors: { origin: ["http://127.0.0.1:3005"] },
  },
  // No tanstackStart(), router, loader or server functions in this app.
  // Only the build adapter is reused to emit a compatible browser + Node container.
  environments: { client: { source: { entry: { index: "./src/index.tsx" } } } },
  plugins: [
    pluginReact(),
    ...tanstackStartModuleFederation({
      federation: {
        name: "warehouse",
        dev: { disableDynamicRemoteTypeHints: true },
        exposes: { "./WarehousePanel": "./src/WarehousePanel.tsx" },
        dts: { generateTypes: { abortOnError: true }, consumeTypes: false },
      },
      server: true,
    }),
  ],
});
