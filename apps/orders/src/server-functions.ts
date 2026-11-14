import { createServerFn } from "@tanstack/react-start";

// Same source path and export name as catalog: exercises colliding production IDs.
export const listProducts = createServerFn({ method: "POST" })
  .validator((data: { fail: boolean; delayMs: number; customer: string }) => {
    if (
      !data ||
      typeof data.fail !== "boolean" ||
      !Number.isInteger(data.delayMs) ||
      data.delayMs < 0 ||
      data.delayMs > 2500 ||
      typeof data.customer !== "string" ||
      data.customer.length > 80
    ) {
      throw new Error("Invalid orders query");
    }
    return data;
  })
  .handler(async ({ data }) => {
    await new Promise((resolve) => setTimeout(resolve, data.delayMs));
    if (data.fail) throw new Error("Intentional orders backend failure");
    const { orders } = await import("./data");
    return {
      rows: orders.filter((row) =>
        row.customer.toLowerCase().includes(data.customer.toLowerCase()),
      ),
      server: {
        app: "orders" as const,
        pid: process.pid,
        time: new Date().toISOString(),
      },
    };
  });
