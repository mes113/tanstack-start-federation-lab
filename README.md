# Folio — TanStack Start federation lab

A host shell and a remote catalog page built with **TanStack Start + Module Federation + Rsbuild**.
The interface uses **shadcn/ui** components, Tailwind CSS 4, Lucide, and **TanStack Table v8**.
The remote backend owns a demo catalog of 96 products. Search, sorting, filtering, and
pagination run in the remote's server function; the browser receives only the requested page.

## Getting started

Use Node.js 22.18+ or 24.11+ and npm. Tested with Node 24.22.1 on Windows.

```sh
npm ci
npm run build
npm run dev
```

- [Host / shell](http://127.0.0.1:3005/)
- [Standalone remote](http://127.0.0.1:3004/)

The first build generates route trees and remote types. Development starts the remote,
waits for its manifest, and then starts the host. For production preview, stop development,
run `npm run build`, then `npm run preview`. Do not run both modes on the same ports.

## Interface

The host owns the sidebar, workspace header, breadcrumbs, and page shell. The remote
owns the catalog heading, statistics, table, and loading and error states.

- Server-side search by product name, SKU, and category with a 300 ms debounce.
- Status and category filters, with a clear-filters action.
- Server-side sorting by name, price, and inventory.
- Pagination with page sizes of 8, 16, or 32 rows.
- Row selection and CSV export of selected rows or the current page.
- Loading skeletons, an empty state, and retry when the backend is unavailable.
- A responsive shell and a horizontally scrollable table on small screens.
- Connection details below the table showing the remote backend's PID and response time.

## SSR and server-function transport

Federation exposes **only `./ServerPanel`**. The host never directly imports or exposes
the server-functions module or `listProducts`.

```text
Initial request to the host
  → host route loader
  → ServerPanel.preload() from the remote component module
  → listProducts in the remote Node container
  → HTTP request to the remote backend :3004
  → table rows, statistics, and data in the server-rendered HTML

Table interaction after hydration
  → remote component event handler
  → listProducts
  → POST /_federation/catalog/_serverFn/<id> on the host :3005
  → createRemoteServerFunctions in the host middleware
  → remote backend :3004
```

`preload` is a component-owned method for loading initial data, rather than a direct
server-function export. The host passes its result back to the component as `initialData`.
Hydration reuses that result without an additional browser RPC. The standalone remote
uses the same `preload` method in its route loader. Table data is present before JavaScript
runs; subsequent interactions call server functions without reloading the page.

The remote sets `serverFns.base` to `/_federation/catalog/_serverFn`.
The host uses the official `createRemoteServerFunctions` forwarder, without a local
transport fork. The data is a demo fixture, with no database or persistent writes.
Authentication and cookie forwarding are outside this example's scope.

## Remote types

The remote generates `@mf-types.zip` and `@mf-types.d.ts`, advertised by its manifest.
The host downloads the archive using the official DTS consumer with `typesOnBuild`
and `abortOnError`. The build runs a temporary remote preview while the host builds
and downloads its types.

`apps/host/tsconfig.json` maps `catalog/*` to `./@mf-types/catalog/*`.
There are no handwritten `declare module "catalog/..."` shims or imports of remote
source files in the host. The types of `preload`, `initialData`, table rows, and the
literal `app: "catalog"` survive declaration generation.

```sh
npm run typecheck
```

`apps/host/src/remote-types.check.tsx` checks valid props and DTOs, the absence of `any`
in the component contract, required `initialData`, incorrect `title` types, unknown
props and fields, price types, statuses, and `preload` arguments. Invalid examples use
`@ts-expect-error`: if these constraints disappear, TypeScript reports unused directives.
The application does not import these examples at runtime.

`skipLibCheck` follows the guidance in PR #22: the MF generator retains stylesheet
imports and default re-exports in its declarations. The application contract is checked
in strict mode. Generated declarations are excluded from Git; rebuild and run typecheck
after changing the remote contract.

## Validation

With ports 3004 and 3005 available:

```sh
npx playwright install chromium
npm test
npm run test:dev
npm run typecheck
npm run format:check
```

`npm test` builds the project and tests production preview; `test:dev` tests development
servers. Both commands manage and stop their own processes.

The browser scenario checks eight rows in the initial server-rendered HTML of both apps,
remote backend data, no duplicate hydration RPC, downloaded declarations, POST requests
through the host, pagination, search, sorting, both filters, the empty state, selection,
CSV export, and the mobile viewport. It also stops the remote, checks a 502 response,
restarts it, and verifies recovery with a new PID without restarting the host or reloading
the page. Hydration errors and uncaught browser errors fail the test. Screenshots are
saved to `test-results/`.

To test an outage manually, run the applications in separate terminals:

```sh
npm run dev --workspace @lab/remote
npm run dev --workspace @lab/host
```

Once the host is loaded, stop the remote and click Refresh in the table to see the error.
Restart the remote and click Try again. The PID under Connection details changes.

## PR coverage and attribution

`@module-federation/tanstack` is pinned to the PR #22 preview commit `391f4cc`, which
includes PR #21. Both PRs had been merged when this project was prepared.

- [PR #21](https://github.com/module-federation/tanstack/pull/21): POST, outage/recovery, and function-ID collision coverage.
- [PR #22](https://github.com/module-federation/tanstack/pull/22): publishing and consuming remote types.
- [Original mes113 prototype](https://github.com/mes113/module-federation-ssr): the host server-function registry problem and a remote transport solution.

This example uses one remote; it does not test function-ID collisions between two remotes.
The base configuration and router come from the MIT-licensed module-federation/tanstack
examples; their notice is retained in `LICENSE.upstream`.
Components in `apps/remote/src/components/ui` come from the official
[shadcn/ui registry](https://ui.shadcn.com/r/styles/new-york-v4/button.json) (MIT), with
`cn` imports adapted to the local utility. `scripts/add-ui.mjs` refreshes them.
The shared shell and remote theme lives in `apps/theme.css`.
