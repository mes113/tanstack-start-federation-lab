import { defineConfig, js, ts } from "@rslint/core";
export default defineConfig([
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/@mf-types/**",
      "**/routeTree.gen.ts",
      "**/.mf/**",
      ".rstack-reference/**",
      ".rstest/**",
      "test-results/**",
      "coverage/**",
    ],
  },
  js.configs.recommended,
  ts.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Compile-time negative examples intentionally contain unused invalid values.
  {
    files: ["**/*types.check.tsx"],
    rules: { "@typescript-eslint/no-unused-vars": "off" },
  },
]);
