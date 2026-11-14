import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/rsbuild";
import { tanstackStartModuleFederation } from "@module-federation/tanstack/rsbuild";

export default defineConfig({
  dev: { lazyCompilation: false },
  server: { host: "127.0.0.1", port: 3005, strictPort: true },
  plugins: [
    pluginReact(),
    tanstackStart(),
    ...tanstackStartModuleFederation({
      federation: {
        name: "host",
        dev: { disableDynamicRemoteTypeHints: true },
        shareStrategy: "loaded-first",
        remotes: {
          catalog: "catalog@http://127.0.0.1:3004/mf-manifest.json",
          orders: "orders@http://127.0.0.1:3006/mf-manifest.json",
          warehouse: "warehouse@http://127.0.0.1:3007/mf-manifest.json",
        },
        dts: {
          generateTypes: false,
          consumeTypes: {
            typesOnBuild: true,
            abortOnError: process.env.MF_OFFLINE_TYPES !== "1",
          },
        },
      },
      server: { ssrEntryLoader: { fetchTimeoutMs: 1500 } },
    }),
  ],
});
