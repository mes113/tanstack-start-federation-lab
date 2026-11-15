import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { preflight } from "./doctor.mjs";
try {
  await preflight("test");
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const mode = process.argv[2] ?? "preview";
const filters = process.argv.slice(3);
const child = spawn(
  process.execPath,
  [resolve("node_modules/@rstest/core/bin/rstest.js"), "run", ...filters],
  {
    stdio: "inherit",
    windowsHide: true,
    env: {
      ...process.env,
      LAB_RUNTIME: mode,
      LAB_TEST_MODE: "1",
      LAB_SESSION_SECRET: "rstest-local-fixture-secret",
    },
  },
);
const [code] = await once(child, "exit");
process.exitCode = code ?? 1;
