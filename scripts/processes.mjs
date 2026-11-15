import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";

const cli = resolve("node_modules/@rsbuild/core/bin/rsbuild.js");
const children = new Set();
export function start(app, command, env = {}, args = []) {
  const child = spawn(
    process.execPath,
    [
      ...(process.env.LAB_TEST_MODE === "1" ? ["--expose-gc"] : []),
      cli,
      command,
      ...args,
    ],
    {
      cwd: resolve("apps", app),
      stdio: "inherit",
      windowsHide: true,
      env: {
        ...process.env,
        NODE_ENV: command === "dev" ? "development" : "production",
        NO_COLOR: "1",
        ...env,
      },
    },
  );
  children.add(child);
  child.once("exit", () => children.delete(child));
  return child;
}
export async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, "exit");
  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    await once(killer, "exit");
  } else child.kill("SIGTERM");
  await exited;
}
export async function cleanup() {
  await Promise.all([...children].map(stop));
}
export async function run(app, command, env = {}) {
  const child = start(app, command, env);
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`${app} ${command} failed: ${code}`);
}
export async function waitFor(url, child) {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null)
      throw new Error(`Server exited: ${url}`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(3000) })).ok) return;
    } catch {
      /* The server can refuse requests while compiling; retry until the deadline. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${url}`);
}
