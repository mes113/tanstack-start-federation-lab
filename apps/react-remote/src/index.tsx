import { createRoot } from "react-dom/client";
import WarehousePanel from "./WarehousePanel";
createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 700, margin: "50px auto" }}>
    <WarehousePanel warehouse="Tallinn warehouse" openOrders={3} />
  </main>,
);
