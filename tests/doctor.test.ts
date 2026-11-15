import { expect, test } from "@rstest/core";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, basename, resolve } from "node:path";
import {
  inspectEnvironment,
  portAvailable,
  portsForMode,
  supportedNode,
} from "../scripts/doctor.mjs";

test.each(["22.18.0", "22.20.0", "24.11.0", "26.0.0"])(
  "accepts supported Node %s",
  (version) => expect(supportedNode(version)).toBe(true),
);
test.each(["20.19.0", "22.17.0", "23.0.0", "24.10.0", "25.0.0"])(
  "rejects unsupported Node %s",
  (version) => expect(supportedNode(version)).toBe(false),
);
test("uses separate ports for federation and includes the E2E fault proxy", () => {
  expect(portsForMode("federation")).toEqual([3404, 3406]);
  expect(portsForMode("test")).toContain(3016);
  expect(() => portsForMode("unknown")).toThrow("Unknown mode");
});
test("detects the installed Playwright browser across package export formats", async () => {
  const checks = await inspectEnvironment({ mode: "test", checkPorts: false });
  expect(checks.find((check) => check.name === "Chromium")?.status).toBe(
    existsSync(chromium.executablePath()) ? "ok" : "error",
  );
});
test("detects a port conflict without stopping the existing listener", async () => {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing TCP address");
  try {
    expect(await portAvailable(address.port)).toBe(false);
    expect(server.listening).toBe(true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  expect(await portAvailable(address.port)).toBe(true);
});
test("an uninstalled checkout reports dependencies and blocks preview without artifacts", async () => {
  const root = await mkdtemp(join(tmpdir(), "federation-doctor-"));
  try {
    await writeFile(
      join(root, "package.json"),
      JSON.stringify({ name: "tanstack-federation-pr-lab" }),
    );
    const checks = await inspectEnvironment({
      root,
      mode: "preview",
      checkPorts: false,
    });
    expect(
      checks.find((check) => check.name === "Dependencies")?.detail,
    ).toContain("npm ci");
    expect(
      checks.find((check) => check.name === "Production build")?.status,
    ).toBe("error");
    expect(
      (await inspectEnvironment({ root, mode: "dev", checkPorts: false })).find(
        (check) => check.name === "Production build",
      )?.status,
    ).toBe("info");
  } finally {
    expect(dirname(resolve(root))).toBe(resolve(tmpdir()));
    expect(basename(root)).toMatch(/^federation-doctor-/);
    await rm(root, { recursive: true, force: true });
  }
});
