import { createServerFn } from "@tanstack/react-start";
import type { ProductsInput } from "./types";

export const listProducts = createServerFn({ method: "POST" })
  .validator((data: ProductsInput) => {
    if (
      !data ||
      !Number.isInteger(data.pageIndex) ||
      data.pageIndex < 0 ||
      ![8, 16, 32].includes(data.pageSize) ||
      typeof data.search !== "string" ||
      data.search.length > 120 ||
      !["All", "Active", "Draft", "Archived"].includes(data.status) ||
      ![
        "All",
        "Electronics",
        "Accessories",
        "Home & living",
        "Stationery",
      ].includes(data.category) ||
      !["name", "price", "stock"].includes(data.sortBy) ||
      typeof data.desc !== "boolean"
    ) {
      throw new Error("Invalid catalog query");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { products } = await import("./data/products");
    await new Promise((resolve) => setTimeout(resolve, 280));
    const search = data.search.trim().toLowerCase();
    const filtered = products
      .filter(
        (p) =>
          (data.status === "All" || p.status === data.status) &&
          (data.category === "All" || p.category === data.category) &&
          (!search ||
            `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(search)),
      )
      .sort((a, b) => {
        const order =
          data.sortBy === "name"
            ? a.name.localeCompare(b.name, "en")
            : a[data.sortBy] - b[data.sortBy];
        return (data.desc ? -order : order) || a.id.localeCompare(b.id);
      });
    const counts = {
      All: products.length,
      Active: products.filter((p) => p.status === "Active").length,
      Draft: products.filter((p) => p.status === "Draft").length,
      Archived: products.filter((p) => p.status === "Archived").length,
    };
    return {
      rows: filtered.slice(
        data.pageIndex * data.pageSize,
        (data.pageIndex + 1) * data.pageSize,
      ),
      rowCount: filtered.length,
      counts,
      stats: {
        lowStock: products.filter((p) => p.stock < 20).length,
        value: products.reduce((sum, p) => sum + p.price * p.stock, 0),
      },
      server: {
        app: "catalog" as const,
        pid: process.pid,
        time: new Date().toISOString(),
      },
    };
  });
