import { cleanup, run, start, stop, waitFor } from "./processes.mjs";

const mode = process.argv[2] ?? "dev";
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    void cleanup().then(() => process.exit(0));
  });
async function build() {
  await run("remote", "build");
  const artifacts = start("remote", "preview");
  try {
    await waitFor("http://127.0.0.1:3004/mf-manifest.json", artifacts);
    await run("host", "build");
  } finally {
    await stop(artifacts);
  }
}
try {
  if (["build", "test"].includes(mode)) await build();
  if (mode === "build") process.exitCode = 0;
  else {
    const command = ["dev", "test:dev"].includes(mode) ? "dev" : "preview";
    let remote = start("remote", command);
    await waitFor("http://127.0.0.1:3004/mf-manifest.json", remote);
    const host = start("host", command);
    await waitFor("http://127.0.0.1:3005", host);
    if (mode.startsWith("test")) {
      const { verify } = await import("../tests/scenario.mjs");
      await verify({
        stopRemote: () => stop(remote),
        restartRemote: async () => {
          remote = start("remote", command);
          await waitFor("http://127.0.0.1:3004/mf-manifest.json", remote);
        },
      });
    } else {
      console.log(
        "Host: http://127.0.0.1:3005 | Remote: http://127.0.0.1:3004",
      );
      await new Promise((_, reject) => {
        for (const child of [host, remote])
          child.once("exit", (code) =>
            reject(new Error(`Server exited (${code})`)),
          );
      });
    }
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
