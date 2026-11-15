import { createServerFn } from "@tanstack/react-start";
import { validateProductsInput } from "./catalog-input";

export const listProducts = createServerFn({ method: "POST" })
  .validator(validateProductsInput)
  .handler(async ({ data }) => {
    const started = performance.now();
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const requestId =
      getRequestHeader("x-lab-request-id") ?? crypto.randomUUID();
    const { products } = await import("./data/products");
    await new Promise((resolve) => setTimeout(resolve, 280));
    const { queryProducts } = await import("./catalog-query");
    return {
      ...queryProducts(products, data),
      server: {
        app: "catalog" as const,
        pid: process.pid,
        time: new Date().toISOString(),
        requestId,
        viaHost: !!getRequestHeader("x-lab-request-id"),
        durationMs: Math.round(performance.now() - started),
      },
    };
  });
