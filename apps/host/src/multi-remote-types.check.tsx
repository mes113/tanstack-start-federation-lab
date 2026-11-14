import OrdersPanel from "orders/OrdersPanel";
import WarehousePanel from "warehouse/WarehousePanel";
import { ssrRemote } from "./components/ssr-remote";

export const orders = <OrdersPanel initialData={null} />;
export const warehouse = <WarehousePanel warehouse="Tallinn" openOrders={3} />;
// @ts-expect-error Plain React remote props remain typed across federation.
export const badWarehouse = <WarehousePanel warehouse={42} openOrders={3} />;
export const badOrders = (
  // @ts-expect-error Orders data must use the remote DTO, not arbitrary arrays.
  <OrdersPanel initialData={{ rows: ["invalid"] }} />
);
const TypedWarehouse = ssrRemote(
  () => import("warehouse/WarehousePanel"),
).Component;
export const badPreloadedWrapper = (
  // @ts-expect-error The SSR wrapper must preserve the generated remote props.
  <TypedWarehouse warehouse="Tallinn" openOrders="three" />
);
export async function checkOrdersDTO() {
  const value = await OrdersPanel.preload({ customer: "Jordan" });
  const app: "orders" = value.server.app;
  // @ts-expect-error Backend identity must not be widened to catalog or string.
  const wrongApp: "catalog" = value.server.app;
  // @ts-expect-error The loader input rejects incorrect field types.
  await OrdersPanel.preload({ delayMs: "slow" });
  return { app, wrongApp };
}
