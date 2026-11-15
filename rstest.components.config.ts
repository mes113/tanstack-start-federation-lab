import { defineConfig } from "@rstest/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  name: "components",
  plugins: [pluginReact()],
  // The component calls this RPC boundary. Real Start compilation and transport
  // are exercised separately by native federation and browser integration tests.
  resolve: {
    alias: {
      "../server-functions$": fileURLToPath(
        new URL("./tests/components/catalog-rpc.ts", import.meta.url),
      ),
    },
  },
  testEnvironment: "happy-dom",
  include: ["tests/components/**/*.test.tsx"],
  setupFiles: ["tests/components/setup.ts"],
});
