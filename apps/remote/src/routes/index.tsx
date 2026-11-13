import { createFileRoute } from "@tanstack/react-router";
import ServerPanel from "../components/ServerPanel";
export const Route = createFileRoute("/")({
  loader: async () => ({
    initialData: await ServerPanel.preload().catch(() => null),
  }),
  component: Standalone,
});

function Standalone() {
  const { initialData } = Route.useLoaderData();
  return (
    <main className="standalone-content">
      <ServerPanel title="Products" initialData={initialData} />
    </main>
  );
}
