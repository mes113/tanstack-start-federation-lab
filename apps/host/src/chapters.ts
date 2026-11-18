export const catalogChapter = {
  steps: [
    {
      action: "Read the initial catalog",
      expect:
        "Eight rows are supplied by the remote preload. Use Tests to verify the HTML without JavaScript.",
    },
    {
      action: "Search for headphones",
      expect:
        "After the request completes, the remote returns matching rows and a new result count.",
    },
    {
      action: "Change page or sort by Price",
      expect:
        "The catalog backend supplies the new result. Select a row to export just that row.",
    },
  ],
  number: "02 / DATA & SSR",
  title: "A remote that owns its data",
  description:
    "Search a real product catalog. Trace how initial HTML and later browser requests reach the same remote backend.",
  question: "Can the host render remote data before JavaScript runs?",
  expected:
    "Eight product rows are in the initial HTML. Search and pagination then call the catalog backend through the host.",
  file: "apps/host/src/routes/index.tsx",
  code: `// Host route loader: preload through the component module.
const remote = await ServerPanel.preload();
const initialData = await remote.default.preload(); // Fetch catalog data.

// The remote owns the table and its private server function.
<ServerPanel title="Products" initialData={initialData} />

// After hydration, its calls use the host namespace:
// POST /_federation/catalog/_serverFn/<id>`,
  command: "npm run test:multi\nnpm run typecheck",
  checks: [
    "Table rows and backend identity exist in SSR HTML.",
    "Hydration reuses the loader result without another browser RPC.",
    "Search, filters, pagination, CSV and backend recovery work.",
  ],
};
export const resilienceChapter = {
  steps: [
    {
      action: "Start with Healthy workspace",
      expect: "Host, catalog, orders and the React checklist appear together.",
    },
    {
      action: "Choose Backend exception",
      expect:
        "Orders shows its error screen. The catalog and checklist remain usable.",
    },
    {
      action: "Choose Recover all modules",
      expect:
        "Orders loads again. Use Tests for restart and no-JavaScript checks.",
    },
  ],
  number: "04 / ERRORS & RECOVERY",
  title: "Compose it. Break it. Recover it.",
  description:
    "Four independent applications share one page. Introduce a failure and see how far it propagates.",
  question: "Does one failing remote take the whole page down?",
  expected:
    "A remote failure has a visible fallback while healthy modules stay usable. A host loader failure produces a page-level error.",
  file: "apps/host/src/routes/lab.tsx",
  code: `// Each component loads independently in the route loader.
await Promise.all([
  Catalog.preload(),
  Orders.preload(),
  Warehouse.preload(),
]);

// Each rendered module gets its own error boundary.
<RemoteBoundary name="Orders">
  <Suspense fallback={<RemoteError name="Orders" />}>
    <Orders initialData={data.orders.data} />
  </Suspense>
</RemoteBoundary>
// See the source for complete loading and fallback handling.`,
  command: "npm run test:multi\nnpm run test:advanced",
  checks: [
    "Catalog, orders and a plain React remote render together with JS disabled.",
    "Backend errors, timeouts and React render failures have isolated fallbacks.",
    "A restarted remote recovers while healthy modules continue working.",
  ],
};
export const sessionChapter = {
  steps: [
    {
      action: "Choose Alice and add a note",
      expect: "The remote accepts the write and shows a successful response.",
    },
    {
      action: "Choose Bob and try adding a note",
      expect:
        "Bob sees his own notes; the backend rejects the write with HTTP 403.",
    },
    {
      action: "Sign out and refresh",
      expect:
        "The remote denies private data. Use the lesson menu for retries, races and navigation.",
    },
  ],
  number: "03 / SESSIONS & WRITES",
  title: "One session. Independent access decisions.",
  description:
    "Use a private notes app to explore identity forwarding, permissions, retries and out-of-order requests.",
  question: "Who decides whether a federated request is allowed?",
  expected:
    "The orders backend verifies the session. Alice can write, Bob gets 403, and guests cannot read private notes.",
  file: "apps/host/src/start.ts",
  code: `// Host: forward only the allowed session cookie.
orders: {
  origin: "http://127.0.0.1:3006",
  headers: ({ request }) => ({
    cookie: forwardSessionCookie(request?.headers.get("cookie")),
  }),
}
// The remote verifies the signed session independently.
// Its store checks the role and ownership for every write.`,
  command: "npm run test:advanced\nnpm run typecheck",
  checks: [
    "Signed sessions stay isolated across SSR and browser requests.",
    "Writes enforce role, validation, idempotency and version checks.",
    "Stale responses cannot replace a newer search or route state.",
  ],
};
