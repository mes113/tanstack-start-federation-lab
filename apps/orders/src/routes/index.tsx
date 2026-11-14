import { createFileRoute } from "@tanstack/react-router";
import OrdersPanel from "../components/OrdersPanel";
export const Route = createFileRoute("/")({
  loader: async () => ({
    initialData: await OrdersPanel.preload().catch(() => null),
  }),
  component: Standalone,
});
function Standalone() {
  const { initialData } = Route.useLoaderData();
  return (
    <main className="standalone-content">
      <OrdersPanel initialData={initialData} />
    </main>
  );
}
