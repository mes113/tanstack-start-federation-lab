import { rs } from "@rstest/core";
import type { listProducts as realListProducts } from "../../apps/remote/src/server-functions";

export const listProducts = rs.fn<typeof realListProducts>();
