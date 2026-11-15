import { Button } from "@lab/ui/button";
import { ChapterWorkbench } from "../components/ChapterWorkbench";
import { BoundaryFrame } from "../components/HandbookShell";
import { resilienceChapter } from "../chapters";
import { getRemoteStylesheets } from "@module-federation/tanstack/runtime";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Suspense, useState } from "react";
import { RemoteBoundary, RemoteError } from "../components/RemoteBoundary";
import { getHostSummary } from "../host-functions";
import { ssrRemote } from "../components/ssr-remote";

const catalogRemote = ssrRemote(() => import("catalog/ServerPanel"));
const ordersRemote = ssrRemote(() => import("orders/OrdersPanel"));
const warehouseRemote = ssrRemote(() => import("warehouse/WarehousePanel"));
const Catalog = catalogRemote.Component;
const Orders = ordersRemote.Component;
const Warehouse = warehouseRemote.Component;
const faults = [
  "none",
  "orders-data",
  "orders-timeout",
  "react-render",
  "host-loader",
] as const;
type Fault = (typeof faults)[number];

export const Route = createFileRoute("/lab")({
  validateSearch: (search: Record<string, unknown>): { fault: Fault } => ({
    fault: faults.includes(search.fault as Fault)
      ? (search.fault as Fault)
      : "none",
  }),
  loaderDeps: ({ search }) => ({ fault: search.fault }),
  loader: async ({ deps }) => {
    if (deps.fault === "host-loader")
      throw new Error("Intentional host loader failure");
    const [host, catalog, orders, warehouse, stylesheets] = await Promise.all([
      getHostSummary(),
      catalogRemote
        .load()
        .then(async (module) => ({
          available: true,
          data: await module.default.preload().catch(() => null),
        }))
        .catch(() => ({ available: false, data: null })),
      ordersRemote
        .load()
        .then(async (module) => ({
          available: true,
          data: await module.default
            .preload({
              fail: deps.fault === "orders-data",
              delayMs: deps.fault === "orders-timeout" ? 2200 : 50,
            })
            .catch(() => null),
        }))
        .catch(() => ({ available: false, data: null })),
      warehouseRemote
        .load()
        .then(() => true)
        .catch(() => false),
      Promise.all(
        [
          [3004, "ServerPanel"],
          [3006, "OrdersPanel"],
          [3007, "WarehousePanel"],
        ].map(([port, expose]) =>
          getRemoteStylesheets(
            `http://127.0.0.1:${port}/mf-manifest.json`,
            `./${expose}`,
          ).catch(() => []),
        ),
      ).then((lists) => lists.flat()),
    ]);
    return { host, catalog, orders, warehouse, stylesheets, fault: deps.fault };
  },
  head: ({ loaderData }) => ({
    links: loaderData?.stylesheets.map((href) => ({ href, rel: "stylesheet" })),
  }),
  errorComponent: HostError,
  component: Lab,
});

function HostError() {
  return (
    <main className="standalone-content" data-testid="host-error-screen">
      <a href="/">← Back to catalog</a>
      <div className="lab-page-heading">
        <span className="lab-kicker">WORKSPACE ERROR</span>
        <h1>We couldn’t prepare this workspace</h1>
        <p>
          The host loader failed before rendering. This error screen is rendered
          on the server.
        </p>
        <a className="lab-primary-link" href="/lab">
          Try workspace again
        </a>
      </div>
    </main>
  );
}

function HostPanel({
  data,
}: {
  data: Awaited<ReturnType<typeof getHostSummary>>;
}) {
  const [answer, setAnswer] = useState(data);
  const [failed, setFailed] = useState(false);
  if (failed) throw new Error("Intentional host component render failure");
  return (
    <section className="lab-card" data-testid="host-panel">
      <header>
        <div>
          <span className="lab-kicker">HOST · TANSTACK START</span>
          <h2>{answer.workspace}</h2>
        </div>
        <span className="lab-tag">:3005</span>
      </header>
      <p className="lab-description">
        Shell, route loader, server function and SSR composition live here.
      </p>
      <div className="host-summary">
        <span className="footer-dot" />
        {answer.message}
      </div>
      <code data-testid="host-server">
        host · PID {answer.pid} · {answer.time}
      </code>
      <div className="lab-actions">
        <Button
          variant="outline"
          onClick={() => void getHostSummary().then(setAnswer)}
        >
          Refresh host
        </Button>
        <Button variant="outline" onClick={() => setFailed(true)}>
          Simulate host crash
        </Button>
      </div>
    </section>
  );
}

function Lab() {
  const data = Route.useLoaderData();
  return (
    <main className="lab-workspace" id="demo-content">
      <div className="lab-topbar">
        <Link to="/scenarios" search={{ query: "", page: 0, sort: "asc" }}>
          Advanced scenarios
        </Link>
        <a href="/">← Product catalog</a>
        <span>Composition sandbox</span>
      </div>
      <ChapterWorkbench
        {...resilienceChapter}
        observed={`Catalog: ${data.catalog.data ? `${data.catalog.data.rows.length} rows received` : "no data"}. Orders: ${data.orders.data ? `${data.orders.data.rows.length} rows received` : "no data"}. React module: ${data.warehouse ? "loaded" : "unavailable"}. Check each panel below for rendering errors.`}
      >
        <div className="fault-toolbar">
          <span className="learn-section-label">
            CHOOSE A FAILURE TO INVESTIGATE
          </span>
          <Link to="/lab" search={{ fault: "none" }} className="fault-reset">
            {data.fault === "none"
              ? "Healthy workspace"
              : "Recover all modules"}
          </Link>
        </div>
        <nav className="fault-cards" aria-label="SSR fault scenarios">
          {[
            [
              "orders-data",
              "Backend exception",
              "Orders returns an application error. The other modules should keep rendering.",
            ],
            [
              "orders-timeout",
              "Slow backend",
              "Orders exceeds the host timeout. Expect a fallback, while the shell remains usable.",
            ],
            [
              "react-render",
              "React render error",
              "The plain React remote throws during SSR. Inspect its module fallback.",
            ],
            [
              "host-loader",
              "Host loader error",
              "The page loader fails. Expect a page-level error rather than a module fallback.",
            ],
          ].map(([fault, title, description]) => (
            <Link
              key={fault}
              to="/lab"
              search={{ fault: fault as Fault }}
              data-active={data.fault === fault}
            >
              <strong>{title}</strong>
              <p>{description}</p>
              <span>
                {data.fault === fault
                  ? "Active scenario"
                  : "Trigger scenario →"}
              </span>
            </Link>
          ))}
        </nav>
        <section className="resilience-instructions">
          <span className="learn-section-label">TRY THIS SCENARIO</span>
          <h2>
            {data.fault === "none"
              ? "Start healthy. Break one module. Watch the others."
              : data.fault === "orders-data"
                ? "A backend error should stay inside orders."
                : data.fault === "orders-timeout"
                  ? "A slow backend should not block the whole page."
                  : "A rendering error needs a visible module fallback."}
          </h2>
          <p>
            {data.fault === "none"
              ? "All four applications below are rendered by the host. Open a module's fault checks to trigger a browser error, or use the scenario links above to reproduce a failure during SSR."
              : data.fault === "orders-data"
                ? "The orders server function deliberately throws. Expect an orders error panel while the catalog and React checklist remain available. Start serializes this application error in an HTTP 200 RPC response."
                : data.fault === "orders-timeout"
                  ? "Orders delays its answer beyond the host forwarder's 1-second timeout. Expect an orders error panel. Browser requests to this unavailable or slow backend return 502."
                  : "The plain React component deliberately throws during server rendering. Its Suspense fallback keeps a useful error screen visible, including without JavaScript."}
          </p>
          <div>
            <strong>Observe:</strong>
            <span>host data</span>
            <span>catalog rows</span>
            <span>orders state</span>
            <span>React checklist</span>
          </div>
        </section>
        <div className="lab-grid">
          <BoundaryFrame owner="Host">
            <RemoteBoundary name="Host">
              <HostPanel data={data.host} />
            </RemoteBoundary>
          </BoundaryFrame>
          <BoundaryFrame owner="Orders">
            <RemoteBoundary name="Orders">
              <Suspense
                fallback={
                  <RemoteError
                    name="Orders"
                    message="The module could not finish rendering on the server."
                  />
                }
              >
                {data.orders.available ? (
                  <Orders initialData={data.orders.data} />
                ) : (
                  <RemoteError
                    name="Orders"
                    message="The remote entry could not be loaded. Start the orders app and reload this workspace."
                  />
                )}
              </Suspense>
            </RemoteBoundary>
          </BoundaryFrame>
          <BoundaryFrame owner="Warehouse">
            <RemoteBoundary key={data.fault} name="Warehouse">
              <Suspense
                fallback={
                  <RemoteError
                    name="Warehouse"
                    message="The React module could not render on the server. Remove the fault and retry."
                  />
                }
              >
                {data.warehouse ? (
                  <Warehouse
                    warehouse="Tallinn warehouse"
                    openOrders={data.orders.data?.rows.length ?? 0}
                    crash={data.fault === "react-render"}
                  />
                ) : (
                  <RemoteError
                    name="Warehouse"
                    message="The React remote entry could not be loaded."
                  />
                )}
              </Suspense>
            </RemoteBoundary>
          </BoundaryFrame>
        </div>
        <div className="lab-catalog">
          <BoundaryFrame owner="Catalog">
            <RemoteBoundary name="Catalog">
              <Suspense
                fallback={
                  <RemoteError
                    name="Catalog"
                    message="The catalog could not finish rendering."
                  />
                }
              >
                {data.catalog.available ? (
                  <Catalog
                    title="Product catalog"
                    initialData={data.catalog.data}
                  />
                ) : (
                  <RemoteError
                    name="Catalog"
                    message="The catalog remote entry could not be loaded."
                  />
                )}
              </Suspense>
            </RemoteBoundary>
          </BoundaryFrame>
        </div>
      </ChapterWorkbench>
    </main>
  );
}
