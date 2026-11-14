import { createServer } from "node:http";
import { once } from "node:events";

export async function createFaultProxy() {
  let mode = "normal";
  const proxy = createServer(async (request, response) => {
    const activeMode = mode;
    if (activeMode === "disconnect") {
      request.socket.destroy();
      return;
    }
    try {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);
      if (activeMode === "slow-headers")
        await new Promise((resolve) => setTimeout(resolve, 1600));
      const headers = new Headers();
      for (const [name, value] of Object.entries(request.headers))
        if (
          value &&
          ![
            "host",
            "connection",
            "content-length",
            "transfer-encoding",
          ].includes(name)
        )
          headers.set(name, Array.isArray(value) ? value.join(",") : value);
      headers.set("origin", "http://127.0.0.1:3006");
      const upstream = await fetch(`http://127.0.0.1:3006${request.url}`, {
        method: request.method,
        headers,
        ...(body.length ? { body } : {}),
      });
      response.statusCode = upstream.status;
      for (const [name, value] of upstream.headers)
        if (
          ![
            "connection",
            "transfer-encoding",
            "content-length",
            "content-encoding",
          ].includes(name)
        )
          response.setHeader(name, value);
      const bytes = Buffer.from(await upstream.arrayBuffer());
      if (activeMode === "truncated-body") {
        response.setHeader("content-length", bytes.length + 100);
        response.write(
          bytes.subarray(0, Math.max(1, Math.floor(bytes.length / 2))),
        );
        setTimeout(() => response.destroy(), 40);
      } else response.end(bytes);
    } catch {
      if (!response.destroyed) {
        response.statusCode = 502;
        response.end("Lab upstream unavailable");
      }
    }
  });
  proxy.listen(3016, "127.0.0.1");
  await once(proxy, "listening");
  return {
    setMode: (value) => {
      mode = value;
    },
    close: async () => {
      proxy.closeAllConnections();
      await new Promise((resolve) => proxy.close(resolve));
    },
  };
}
