// Type-only contracts: runtime imports still cross the federation containers.
declare module "catalog/ServerPanel" {
  const component: typeof import("../../apps/remote/src/components/ServerPanel").default;
  export default component;
}
declare module "orders/OrdersPanel" {
  const component: typeof import("../../apps/orders/src/components/OrdersPanel").default;
  export default component;
}
declare module "warehouse/WarehousePanel" {
  const component: typeof import("../../apps/react-remote/src/WarehousePanel").default;
  export default component;
}
