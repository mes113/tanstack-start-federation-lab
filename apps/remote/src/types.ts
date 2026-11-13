export type ProductStatus = "Active" | "Draft" | "Archived";
export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  status: ProductStatus;
  price: number;
  stock: number;
  updated: string;
  color: string;
}
export interface ProductsInput {
  pageIndex: number;
  pageSize: number;
  search: string;
  status: string;
  category: string;
  sortBy: "name" | "price" | "stock";
  desc: boolean;
}
