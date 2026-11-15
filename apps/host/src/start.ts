import { createRemoteServerFunctions } from "@module-federation/tanstack/server-functions";
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { forwardSessionCookie } from "@lab/session/cookie";
import { hostMetrics } from "./host-metrics";
import {
  beginTrace,
  endTrace,
  traceHeaders,
  traceResponse,
} from "./request-trace";

const remoteFunctions = createRemoteServerFunctions({
  remotes: {
    catalog: {
      origin: "http://127.0.0.1:3004",
      headers: ({ request }) => traceHeaders(request),
    },
    orders: {
      origin: () =>
        process.env.ORDERS_INTERNAL_ORIGIN ?? "http://127.0.0.1:3006",
      timeoutMs: 1000,
      headers: ({ request }) => ({
        ...traceHeaders(request),
        cookie: forwardSessionCookie(request?.headers.get("cookie")),
      }),
    },
  },
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createMiddleware().server(async ({ next, request }) => {
      const trace = beginTrace(request);
      hostMetrics.active++;
      try {
        if (
          process.env.LAB_TEST_MODE === "1" &&
          new URL(request.url).pathname === "/_lab/metrics"
        ) {
          if (new URL(request.url).searchParams.has("gc")) globalThis.gc?.();
          return Response.json({
            ...hostMetrics,
            pid: process.pid,
            ...process.memoryUsage(),
          });
        }
        const result = await next();
        return { ...result, response: traceResponse(result.response, trace) };
      } finally {
        hostMetrics.active--;
        hostMetrics.completed++;
        endTrace(request);
      }
    }),
    createCsrfMiddleware({
      filter: ({ handlerType }) => handlerType === "serverFn",
    }),
    createMiddleware().server(
      ({ next, request }) => remoteFunctions.handle(request) ?? next(),
    ),
  ],
}));
