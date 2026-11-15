import type { ProductsInput } from "./types";
export function validateProductsInput(data: ProductsInput) {
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
}
