import { afterAll, beforeAll, expect, test } from "@rstest/core";
import { createServer, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import {
  getRemoteStylesheets,
  RemoteFetchError,
  REMOTE_ERROR_CODES,
} from "@module-federation/tanstack/runtime";
import nodeEntryLoader, {
  RemoteEntryError,
} from "@module-federation/tanstack/node-entry-loader";
import { inspectRemoteStyles } from "../apps/host/src/remote-styles";

let origin: string;
let port: number;
let manifestFailure = false;
const manifest = JSON.stringify({
  exposes: [{ name: "Panel", assets: { css: { sync: ["panel.css"] } } }],
});
const server = createServer((request, response) => {
  const path = new URL(request.url!, "http://fixture").pathname;
  if (path === "/network") return request.socket.destroy();
  if (path === "/timeout") return;
  if (path.startsWith("/http/")) {
    response.writeHead(Number(path.split("/").pop()));
    response.end(`  upstream\n unavailable   ${"x".repeat(300)}`);
    return;
  }
  if (path === "/stalled-http") {
    response.writeHead(503);
    response.flushHeaders();
    return;
  }
  if (path === "/parse") return response.end("not JSON");
  if (path === "/large") {
    response.writeHead(200, { "content-length": "10000" });
    return response.end("x".repeat(10000));
  }
  if (path === "/stream-large") {
    response.writeHead(200);
    response.flushHeaders();
    return response.end("x".repeat(10000));
  }
  if (path === "/entry-throw")
    return response.end('throw new Error("bad entry")');
  if (path === "/entry-invalid") return response.end("module.exports = {}");
  if (path === "/entry")
    return response.end("module.exports = { get() {}, init() {} }");
  if (path === "/mf-manifest.json" && manifestFailure) {
    response.writeHead(503);
    return response.end("private upstream body");
  }
  json(response, manifest);
});
function json(response: ServerResponse, body: string) {
  response.setHeader("content-type", "application/json");
  response.end(body);
}

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
  origin = `http://127.0.0.1:${port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

test.each([
  ["network", REMOTE_ERROR_CODES.remoteFetchNetwork, true],
  ["timeout", REMOTE_ERROR_CODES.remoteFetchTimeout, true],
  ["parse", REMOTE_ERROR_CODES.remoteFetchParse, false],
  ["large", REMOTE_ERROR_CODES.remoteFetchBodyTooLarge, false],
  ["stream-large", REMOTE_ERROR_CODES.remoteFetchBodyTooLarge, false],
] as const)(
  "manifest %s has a structured error",
  async (path, code, retryable) => {
    const result = getRemoteStylesheets(`${origin}/${path}`, "./Panel", {
      fetchTimeoutMs: path === "timeout" ? 50 : 1500,
      fetchMaxBytes: 1024,
    });
    await expect(result).rejects.toBeInstanceOf(RemoteFetchError);
    await expect(result).rejects.toMatchObject({
      code,
      retryable,
      url: `${origin}/${path}`,
    });
    if (path === "timeout")
      await expect(result).rejects.toHaveProperty("cause.name", "AbortError");
  },
);

test.each([400, 401, 403, 404, 408, 425, 429, 500, 502, 503])(
  "HTTP %s preserves status and classifies retries",
  async (status) => {
    const error = await getRemoteStylesheets(
      `${origin}/http/${status}`,
      "./Panel",
    ).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(RemoteFetchError);
    expect(error).toMatchObject({
      code: REMOTE_ERROR_CODES.remoteFetchHttp,
      status,
      retryable: [408, 425, 429].includes(status) || status >= 500,
    });
    const preview = (error as RemoteFetchError).bodyPreview!;
    expect(preview).toMatch(/^upstream unavailable x/);
    expect([...preview].length).toBeLessThanOrEqual(240);
    expect((error as RemoteFetchError).statusText).toBeTruthy();
  },
);

test("a stalled HTTP error body preserves HTTP classification after the fetch deadline", async () => {
  await expect(
    getRemoteStylesheets(`${origin}/stalled-http`, "./Panel", {
      fetchTimeoutMs: 100,
    }),
  ).rejects.toMatchObject({
    code: REMOTE_ERROR_CODES.remoteFetchHttp,
    status: 503,
    retryable: true,
  });
});

function loadEntry(path: string) {
  const plugin = nodeEntryLoader({ fetchTimeoutMs: 100, fetchMaxBytes: 1024 });
  // The CommonJS hook reads only remoteInfo; other runtime internals are not used.
  return plugin.loadEntry!({
    remoteInfo: {
      name: "fixture",
      entry: `${origin}/${path}`,
      type: "commonjs-module",
    },
  } as Parameters<NonNullable<typeof plugin.loadEntry>>[0]);
}

test.each([
  ["network", REMOTE_ERROR_CODES.remoteFetchNetwork, true],
  ["timeout", REMOTE_ERROR_CODES.remoteFetchTimeout, true],
  ["http/503", REMOTE_ERROR_CODES.remoteFetchHttp, true],
  ["http/404", REMOTE_ERROR_CODES.remoteFetchHttp, false],
  ["large", REMOTE_ERROR_CODES.remoteFetchBodyTooLarge, false],
] as const)(
  "CommonJS SSR entry %s retains its fetch cause",
  async (path, code, retryable) => {
    const result = loadEntry(path);
    await expect(result).rejects.toBeInstanceOf(RemoteEntryError);
    await expect(result).rejects.toMatchObject({
      code,
      retryable,
      phase: "fetch",
      remote: "fixture",
      url: `${origin}/${path}`,
      cause: { code, retryable },
    });
  },
);

test.each(["entry-throw", "entry-invalid"])(
  "invalid CommonJS %s is not a retryable fetch failure",
  async (path) => {
    await expect(loadEntry(path)).rejects.toMatchObject({
      code: REMOTE_ERROR_CODES.remoteEntryEvaluate,
      phase: "evaluate",
      retryable: false,
    });
  },
);

test("a healthy CommonJS container still loads", async () => {
  await expect(loadEntry("entry")).resolves.toMatchObject({
    get: expect.any(Function),
    init: expect.any(Function),
  });
});

test("lab diagnostics omit upstream bodies and retry a failed manifest immediately", async () => {
  manifestFailure = true;
  try {
    const failed = await inspectRemoteStyles("Fixture", port, "./Panel");
    expect(failed.error).toMatchObject({
      code: REMOTE_ERROR_CODES.remoteFetchHttp,
      status: 503,
      retryable: true,
    });
    expect(JSON.stringify(failed)).not.toContain("private upstream body");
    expect(JSON.stringify(failed)).not.toContain(origin);
    manifestFailure = false;
    await expect(
      inspectRemoteStyles("Fixture", port, "./Panel"),
    ).resolves.toEqual({
      name: "Fixture",
      error: null,
      stylesheets: [`${origin}/panel.css`],
    });
  } finally {
    manifestFailure = false;
  }
});

test("a missing expose is a manifest contract error", async () => {
  await expect(
    inspectRemoteStyles("Fixture", port, "./Missing"),
  ).resolves.toMatchObject({
    error: { code: "MANIFEST-CONTRACT", status: null, retryable: false },
    stylesheets: [],
  });
});
