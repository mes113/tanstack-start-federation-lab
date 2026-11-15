import { createRoot } from "react-dom/client";
// The standalone entry owns the base theme. Keep the exposed panel's own CSS
// separate so its stylesheet stays discoverable in the federation manifest.
import "../../theme.css";
import WarehousePanel from "./WarehousePanel";
createRoot(document.getElementById("root")!).render(
  <main style={{ maxWidth: 700, margin: "50px auto" }}>
    <WarehousePanel warehouse="Tallinn warehouse" openOrders={3} />
  </main>,
);
