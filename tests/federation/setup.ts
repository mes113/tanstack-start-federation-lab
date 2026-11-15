import { cleanup, run, start, waitFor } from "../../scripts/processes.mjs";

export async function setup() {
  try {
    await Promise.all(
      ["remote", "orders", "react-remote"].map((app) => run(app, "build")),
    );
    const backends = [
      ["remote", 3404],
      ["orders", 3406],
    ] as const;
    await Promise.all(
      backends.map(async ([app, port]) => {
        const child = start(
          app,
          "preview",
          { LAB_SESSION_SECRET: "rstest-federation-local-fixture" },
          ["--port", String(port)],
        );
        await waitFor(`http://127.0.0.1:${port}/mf-manifest.json`, child);
      }),
    );
  } catch (error) {
    await cleanup();
    throw error;
  }
}

export async function teardown() {
  await cleanup();
}
