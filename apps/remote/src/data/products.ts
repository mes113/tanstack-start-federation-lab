import type { Product, ProductStatus } from "../types";
const collection = [
  ["Studio headphones", "Electronics", 189, "violet"],
  ["Everyday tote", "Accessories", 48, "amber"],
  ["Arc desk lamp", "Home & living", 129, "blue"],
  ["Essential notebook", "Stationery", 24, "rose"],
  ["Ceramic pour-over", "Home & living", 56, "orange"],
  ["Wireless keyboard", "Electronics", 119, "slate"],
  ["Weekender backpack", "Accessories", 145, "green"],
  ["Brass pen set", "Stationery", 38, "amber"],
  ["Linen cushion", "Home & living", 42, "rose"],
  ["Pocket speaker", "Electronics", 79, "blue"],
  ["Leather cardholder", "Accessories", 65, "orange"],
  ["Weekly planner", "Stationery", 28, "violet"],
] as const;
const editions = [
  "",
  " — Sand",
  " — Midnight",
  " — Olive",
  " — Cloud",
  " — Limited",
  " — Mini",
  " — Pro",
];
// Kept in the remote backend; the client receives only the requested page.
export const products: Product[] = editions.flatMap((edition, group) =>
  collection.map(([name, category, price, color], index) => {
    const n = group * collection.length + index;
    const status: ProductStatus =
      n % 9 === 4 ? "Archived" : n % 5 === 3 ? "Draft" : "Active";
    return {
      id: `prd_${String(n + 1).padStart(4, "0")}`,
      name: name + edition,
      sku: `ST-${String(1001 + n)}`,
      category,
      status,
      price: price + group * 5,
      stock: n % 11 === 3 ? 0 : (n * 37 + 24) % 180,
      updated: `2026-11-${String(13 - (n % 12)).padStart(2, "0")}`,
      color,
    };
  }),
);
