import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const modes = ["dev", "build", "preview", "test", "federation"];
export function supportedNode(version) {
  const [major, minor, patch] = version
    .replace(/^v/, "")
    .split(".")
    .map(Number);
  return (
    (major === 22 && (minor > 22 || (minor === 22 && patch >= 2))) ||
    (major === 24 && minor >= 15) ||
    major >= 26
  );
}
export function portsForMode(mode) {
  if (!modes.includes(mode))
    throw new Error(`Unknown mode '${mode}'. Choose ${modes.join(", ")}.`);
  if (mode === "federation") return [3404, 3406];
  if (mode === "build") return [3004, 3006, 3007];
  return mode === "test"
    ? [3004, 3005, 3006, 3007, 3016]
    : [3004, 3005, 3006, 3007];
}
export function portAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.listen({ host: "127.0.0.1", port, exclusive: true }, () =>
      server.close(() => resolve(true)),
    );
  });
}
async function exists(path) {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
export async function inspectEnvironment({
  mode = "dev",
  root = process.cwd(),
  nodeVersion = process.versions.node,
  checkPorts = true,
} = {}) {
  const ports = portsForMode(mode);
  const checks = [];
  const add = (status, name, detail) => checks.push({ status, name, detail });
  add(
    supportedNode(nodeVersion) ? "ok" : "error",
    "Node.js",
    supportedNode(nodeVersion)
      ? nodeVersion
      : `${nodeVersion} is unsupported. Use Node 22.22.2+, 24.15.0+, or 26+ (odd versions below 26 are unsupported).`,
  );
  const manifestPath = resolve(root, "package.json");
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {
    add(
      "error",
      "Workspace",
      "Run this command from the Federation Lab repository root.",
    );
    return checks;
  }
  if (manifest.name !== "tanstack-federation-pr-lab") {
    add("error", "Workspace", "This is not the Federation Lab workspace.");
    return checks;
  }
  const require = createRequire(manifestPath);
  const missing = [
    "@rsbuild/core",
    "@rstest/core",
    "@lab/session",
    "@lab/ui",
  ].filter((name) => {
    try {
      require.resolve(name === "@lab/ui" ? "@lab/ui/button" : name);
      return false;
    } catch {
      return true;
    }
  });
  add(
    missing.length ? "error" : "ok",
    "Dependencies",
    missing.length
      ? `Missing ${missing.join(", ")}. Run npm ci.`
      : "Installed packages and local workspaces resolve.",
  );
  if (checkPorts)
    await Promise.all(
      ports.map(async (port) => {
        const available = await portAvailable(port);
        add(
          available ? "ok" : "error",
          `Port ${port}`,
          available
            ? `Available on 127.0.0.1:${port}.`
            : `127.0.0.1:${port} is already in use. Stop the existing demo/test process with Ctrl+C.`,
        );
      }),
    );
  const artifacts = [
    "apps/host/dist/server/index.cjs",
    "apps/remote/dist/client/remoteEntry.ssr.cjs",
    "apps/orders/dist/client/remoteEntry.ssr.cjs",
    "apps/react-remote/dist/remoteEntry.ssr.cjs",
  ];
  const built = (
    await Promise.all(artifacts.map((path) => exists(resolve(root, path))))
  ).every(Boolean);
  add(
    built ? "ok" : mode === "preview" ? "error" : "info",
    "Production build",
    built
      ? "All app entry points exist. Rebuild after changing source or dependencies."
      : "No complete production build. Run npm run build before npm run preview. Dev and test commands build what they need.",
  );
  if (mode === "test") {
    let browser = false;
    if (!missing.length) {
      try {
        const loaded = await import(
          pathToFileURL(require.resolve("playwright")).href
        );
        const { chromium } = loaded.default ?? loaded;
        browser = await exists(chromium.executablePath());
      } catch {
        /* Missing browser is reported below. */
      }
    }
    add(
      browser ? "ok" : "error",
      "Chromium",
      browser
        ? "Browser executable is installed."
        : "Run npx playwright install chromium (Linux CI: add --with-deps).",
    );
  }
  return checks.sort((a, b) =>
    a.name.localeCompare(b.name, "en", { numeric: true }),
  );
}
export async function preflight(mode) {
  const checks = await inspectEnvironment({ mode });
  const failures = checks.filter((check) => check.status === "error");
  if (failures.length)
    throw Object.assign(
      new Error(
        `Cannot start ${mode}:\n${failures.map((check) => `- ${check.name}: ${check.detail}`).join("\n")}\nRun npm run doctor -- --mode ${mode} for the full report.`,
      ),
      { name: "EnvironmentError" },
    );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const args = process.argv.slice(2);
  const mode =
    args.length === 0
      ? "dev"
      : args.length === 2 && args[0] === "--mode"
        ? args[1]
        : "invalid arguments";
  try {
    const checks = await inspectEnvironment({ mode });
    console.log(`Federation Lab doctor · ${mode}\n`);
    for (const { status, name, detail } of checks)
      console.log(`[${status.toUpperCase()}] ${name}: ${detail}`);
    process.exitCode = checks.some((check) => check.status === "error") ? 1 : 0;
    console.log(
      process.exitCode
        ? "\nResolve the errors above and run the doctor again."
        : "\nReady. This checks local prerequisites, not live backend health.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
