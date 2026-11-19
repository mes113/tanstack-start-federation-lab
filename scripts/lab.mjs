import { cleanup, run, start, stop, waitFor } from "./processes.mjs";
export const apps = { remote: 3004, orders: 3006, "react-remote": 3007 };
export async function buildLab() {
  await Promise.all(Object.keys(apps).map((app) => run(app, "build")));
  const artifacts = Object.entries(apps).map(([app, port]) => [
    start(app, "preview"),
    port,
  ]);
  try {
    await Promise.all(
      artifacts.map(([child, port]) =>
        waitFor(`http://127.0.0.1:${port}/mf-manifest.json`, child),
      ),
    );
    await run("host", "build");
  } finally {
    await Promise.all(artifacts.map(([child]) => stop(child)));
  }
}
export async function startLab(command) {
  const remotes = new Map();
  async function startRemote(app = "remote", env = {}) {
    const child = start(app, command, env);
    remotes.set(app, child);
    await waitFor(`http://127.0.0.1:${apps[app]}/mf-manifest.json`, child);
    // Dev can serve the manifest before Start's server bundle is compiled.
    // Wait for an SSR page before sending RPCs through the host's timeout.
    if (command === "dev" && app !== "react-remote")
      await waitFor(`http://127.0.0.1:${apps[app]}/`, child);
  }
  await Promise.all(Object.keys(apps).map((app) => startRemote(app)));
  let host;
  async function startHost(offlineTypes = false) {
    host = start(
      "host",
      command,
      offlineTypes ? { MF_OFFLINE_TYPES: "1" } : {},
    );
    // Readiness must leave remote modules cold for the first SSR request.
    await waitFor("http://127.0.0.1:3005/guide", host);
  }
  await startHost();
  return {
    command,
    stopRemote: (app = "remote") => stop(remotes.get(app)),
    restartRemote: (app = "remote", env = {}) => startRemote(app, env),
    restartHost: async () => {
      await stop(host);
      await startHost(true);
    },
    buildRemote: (app, env = {}) => run(app, "build", env),
    cleanup,
    wait: () =>
      new Promise((_, reject) => {
        for (const child of [host, ...remotes.values()])
          child.once("exit", (code) =>
            reject(new Error(`Server exited (${code})`)),
          );
      }),
  };
}
