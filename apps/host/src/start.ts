import { createRemoteServerFunctions } from "@module-federation/tanstack/server-functions";
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from "@tanstack/react-start";
import { forwardSessionCookie } from "@lab/session/cookie";
import { hostMetrics } from "./host-metrics";

const remoteFunctions = createRemoteServerFunctions({
  remotes: {
    catalog: { origin: "http://127.0.0.1:3004" },
    orders: {
      origin: () =>
        process.env.ORDERS_INTERNAL_ORIGIN ?? "http://127.0.0.1:3006",
      timeoutMs: 1000,
      headers: ({ request }) => ({
        cookie: forwardSessionCookie(request?.headers.get("cookie")),
      }),
    },
  },
});

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createMiddleware().server(async ({ next, request }) => {
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
        return await next();
      } finally {
        hostMetrics.active--;
        hostMetrics.completed++;
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
