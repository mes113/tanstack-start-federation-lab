export const lessons = [
  {
    id: "sessions",
    number: "01",
    title: "Follow a session",
    short: "Sessions & permissions",
    question: "Can a remote trust the user's session?",
    summary:
      "Choose an identity on the host. The orders backend independently verifies the signed cookie and decides which data and operations are allowed.",
    steps: [
      {
        action: "Select Alice, then refresh the private data.",
        expect:
          "Alice's private item appears. The backend identity is orders, not host.",
      },
      {
        action:
          "Select Bob and try creating an item with a title of 3+ characters.",
        expect:
          "Bob sees his own item. The write is rejected with HTTP 403 because Bob is a viewer.",
      },
      {
        action: "Sign out and refresh again.",
        expect:
          "Private items disappear. A new unauthenticated read returns HTTP 401.",
      },
    ],
    takeaway:
      "The backend enforces access. Federation shares UI code; it does not grant permissions.",
    file: "apps/host/src/start.ts → apps/orders/src/workspace-functions.ts",
    codeTitle: "Forward only the session cookie",
    code: `// Host: allowlist credentials for this remote.
orders: {
  origin: "http://127.0.0.1:3006",
  headers: ({ request }) => ({
    cookie: forwardSessionCookie(
      request?.headers.get("cookie")
    ),
  }),
}

// Orders backend: verify independently.
const actor = verifySession(
  getCookie(sessionCookie)
);
if (!actor) {
  setResponseStatus(401);
  throw new Error("Sign in first.");
}
// Mutations also check actor.role.`,
  },
  {
    id: "mutations",
    number: "02",
    title: "Write without duplicates",
    short: "Mutations & retries",
    question: "What happens if a save is sent twice?",
    summary:
      "The component sends an idempotency key with each new write. The orders backend owns storage, validation and conflict detection.",
    steps: [
      {
        action:
          "Select Alice. Enter a title such as “My test item” and create it.",
        expect:
          "A new row appears with version v1. Reloading keeps it while the orders process remains alive.",
      },
      {
        action: "Open “Test a repeated save” and click “Repeat last save”.",
        expect: "The same item ID is returned. The row count does not grow.",
      },
      {
        action:
          "Open “Edit this note”, enter a new title and save. Try the same note in two tabs to test an outdated edit.",
        expect:
          "The first edit increments the version. Saving the old version from the other tab returns HTTP 409.",
      },
    ],
    takeaway:
      "Retries are safe because the server deduplicates requests. Version checks prevent one edit from silently overwriting another.",
    file: "apps/orders/src/workspace-store.ts",
    codeTitle: "Deduplicate at the backend",
    code: `// The component reuses this key on retry.
await createWorkspaceItem({
  data: { title, requestId },
});

// The remote store returns the original result.
const previous = state.requests.get(requestId);
if (previous) {
  if (previous.title !== clean) {
    throw new WorkspaceError(409,
      "Request ID was already used");
  }
  return { ...previous.note };
}

// Updates require the last known version.
if (note.version !== version) {
  throw new WorkspaceError(409,
    "Item changed. Reload before saving.");
}`,
  },
  {
    id: "races",
    number: "03",
    title: "Keep the newest result",
    short: "Out-of-order requests",
    question: "Can a slow old request replace a newer search?",
    summary:
      "This demo deliberately delays one-character searches by 750 ms. Longer searches take about 40 ms, so responses can arrive out of order.",
    steps: [
      {
        action: "Select Alice. Type “a”, then quickly replace it with “Alice”.",
        expect:
          "The newer search finishes first. The visible query remains Alice when the slow response arrives.",
      },
      {
        action:
          "Repeat with “a”, then open “Sorting & pages” and reverse the sort or move to the next page while it loads.",
        expect: "The older result cannot reset the current page or sort.",
      },
      {
        action:
          "Open “Developer details” and compare the request history with the applied query.",
        expect:
          "The late read is marked as stale; its successful HTTP response is not applied to the screen.",
      },
    ],
    takeaway:
      "Successful responses can still be obsolete. Guard state updates with request identity, not only HTTP status.",
    file: "apps/orders/src/components/WorkspacePanel.tsx",
    codeTitle: "Ignore obsolete responses",
    code: `const current = ++sequence.current;
setPending(true);

const snapshot = await loadWorkspace({
  data: { query, page, sort, delayMs },
});

if (sequence.current === current) {
  setData(snapshot);
}

// An older request must not clear the new
// request's loading state either.
if (sequence.current === current) {
  setPending(false);
}`,
  },
  {
    id: "navigation",
    number: "04",
    title: "Render first. Navigate next.",
    short: "SSR & navigation",
    question: "Do direct links and client navigation agree?",
    summary:
      "The route loader passes server-fetched data into the remote component. URL-backed search is shareable and can be rendered before JavaScript runs.",
    steps: [
      {
        action: "Select Alice, then open Saved search or Descending view.",
        expect:
          "The URL and the remote's initial query change together using client-side navigation.",
      },
      {
        action: "Use browser Back and Forward, then reload the URL.",
        expect:
          "The same view is restored. The route loader supplies the correct private data during SSR.",
      },
      {
        action:
          "Open the same authenticated deep link with JavaScript disabled.",
        expect:
          "The initial items remain visible. The automated navigation test verifies this with an isolated browser context.",
      },
    ],
    takeaway:
      "Server rendering and client navigation use the same component-owned data contract.",
    file: "apps/host/src/routes/scenarios.tsx",
    codeTitle: "Load on the server, reuse on hydration",
    code: `// The route loader loads the UI module.
await remote.load();
const module = await import(
  "orders/OrdersPanel"
);

// This is a component-owned loader, not a
// direct federation expose of a server fn.
const initialData =
  await module.default.preloadWorkspace({
    query, page, sort, delayMs: 40,
  });

// Request data stays in the route result.
<Workspace initialData={initialData} />`,
  },
] as const;
