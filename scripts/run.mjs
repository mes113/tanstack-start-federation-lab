import { buildLab, startLab } from "./lab.mjs";
import { cleanup } from "./processes.mjs";
const mode = process.argv[2] ?? "dev";
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => void cleanup().then(() => process.exit(0)));
try {
  if (mode === "build") await buildLab();
  else {
    const lab = await startLab(mode === "dev" ? "dev" : "preview");
    console.log(
      "Start here http://127.0.0.1:3005/guide | Catalog / | SSR /lab | Lessons /scenarios",
    );
    console.log("Catalog :3004 | Orders :3006 | Plain React :3007");
    await lab.wait();
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
