import type { Product, ProductsInput } from "./types";
export function queryProducts(products: Product[], input: ProductsInput) {
  const search = input.search.trim().toLowerCase();
  const filtered = products
    .filter(
      (p) =>
        (input.status === "All" || p.status === input.status) &&
        (input.category === "All" || p.category === input.category) &&
        (!search ||
          `${p.name} ${p.sku} ${p.category}`.toLowerCase().includes(search)),
    )
    .sort((a, b) => {
      const order =
        input.sortBy === "name"
          ? a.name.localeCompare(b.name, "en")
          : a[input.sortBy] - b[input.sortBy];
      return (input.desc ? -order : order) || a.id.localeCompare(b.id);
    });
  const counts = {
    All: products.length,
    Active: products.filter((p) => p.status === "Active").length,
    Draft: products.filter((p) => p.status === "Draft").length,
    Archived: products.filter((p) => p.status === "Archived").length,
  };
  return {
    rows: filtered.slice(
      input.pageIndex * input.pageSize,
      (input.pageIndex + 1) * input.pageSize,
    ),
    rowCount: filtered.length,
    counts,
    stats: {
      lowStock: products.filter((p) => p.stock < 20).length,
      value: products.reduce((sum, p) => sum + p.price * p.stock, 0),
    },
  };
}
