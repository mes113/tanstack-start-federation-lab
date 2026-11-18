# Testing the federation handbook

[Documentation home](README.md) · [Walkthrough](docs/WALKTHROUGH.md) · [Architecture](docs/ARCHITECTURE.md) · [Development](docs/DEVELOPMENT.md)

## Applications

| App       | Port | Responsibility                                                                              |
| --------- | ---- | ------------------------------------------------------------------------------------------- |
| Host      | 3005 | Shell, `/lab` route loader, host server function, composition, forwarding, error boundaries |
| Catalog   | 3004 | TanStack Start, product table and its private POST server function                          |
| Orders    | 3006 | Independent TanStack Start backend, orders component and its private POST server function   |
| Warehouse | 3007 | React-only component with local checklist state; no TanStack runtime dependency             |

The warehouse app does not register `tanstackStart()`, import a router, or define server
functions. Its build reuses `@module-federation/tanstack/rsbuild` to emit the browser
and Node containers understood by the host. The standalone warehouse page uses `createRoot`
and is client-rendered; **the host renders this remote component during SSR**. The plain
React manifest shares React/React DOM only, with no TanStack shared runtime.

Every remote exposes exactly one component module and generates its own type archive.
The host consumes all three archives. Component props, orders loader inputs, DTOs, and
backend literal identities are checked in `multi-remote-types.check.tsx`; the SSR wrapper
is also checked to ensure it preserves the remote's prop types.

## Running

```sh
npm ci
npx playwright install chromium
npm test                 # Build + original catalog suite + extended production suite
npm run test:dev         # Both suites against development servers
npm run typecheck
npm run lint
npm run format:check
```

For the original catalog and multi-remote regression groups only, use `npm run test:multi`
or `npm run test:multi:dev`. Use `npm run test:advanced` for the ten advanced/handbook
E2E cases and `npm run test:unit` for focused domain and environment checks.
All four application ports and test proxy port 3016 must be free. Rstest owns its processes, deliberately stops
remotes, restarts the host in one scenario, and cleans up afterward.

For manual exploration: `npm run build`, then `npm run dev`, and open
[the SSR workspace](http://127.0.0.1:3005/lab). The scenario cards inject SSR failures; Recover all modules clears the injected fault.
The orders diagnostics contain backend-error and timeout buttons; the warehouse
diagnostics contain a render-error button. Error boundaries provide retry actions.

To stop one app manually without the development orchestrator shutting down the others,
run each workspace's `dev` command in its own terminal, as described in the README.

## Test matrix

| Scenario                                    | Expected behavior                                                                                    |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Five simultaneous SSR requests              | Each contains host data, 8 catalog rows, 3 orders, and the React checklist                           |
| JavaScript disabled                         | All healthy modules remain visible; remote CSS is linked in the initial HTML                         |
| Hydration                                   | No duplicate data RPC, no unexpected errors, checklist responds to input                             |
| Concurrent host/catalog/orders calls        | Each response belongs to its own backend process                                                     |
| Same production function ID                 | Catalog and orders really share an ID; namespace routing keeps their calls separate                  |
| Orders handler throws                       | Start serializes an application error, orders shows its error state, other modules remain usable     |
| Orders forwarding timeout                   | Host gateway returns 502; orders shows retry; catalog and host still work                            |
| SSR orders error or timeout                 | Error screen is visible with JS disabled; the rest of the page remains server-rendered               |
| SSR React render crash                      | Suspense emits a visible module error fallback; healthy sections still render without JS             |
| Host loader fails                           | HTTP 500 and a server-rendered route error page                                                      |
| Unknown route                               | HTTP 404 and a server-rendered not-found page                                                        |
| Browser React render crash                  | Local error boundary isolates the widget; retry remounts it                                          |
| Browser host component crash                | Its boundary isolates the panel, preserving both backend remotes                                     |
| Orders process goes offline                 | Orders RPC returns 502 while catalog RPC succeeds; restart recovers with a new PID without reloading |
| Cold host with orders and warehouse offline | Host still serves catalog and module-unavailable screens                                             |
| Remote recovery after cold startup          | Both modules return without another host restart, including visible SSR with JS disabled             |
| Public browser/SSR container output         | Backend fixture values and handler implementations are absent                                        |

## Findings and SSR details

**Module errors and transport errors differ.** In this pinned Start version, throwing
inside a server-function handler is serialized in an HTTP 200 response and rejects
the typed caller. An unreachable remote or forwarding timeout produces HTTP 502.
An error in the host route loader produces HTTP 500. The suite asserts the observed
protocol, not a generic assumption that every thrown handler error is HTTP 500.

**A successful HTML string check alone is insufficient for full SSR.** React streaming
can send a resolved lazy module inside a hidden container and rely on a script to reveal
it. This appeared during recovery of the warehouse remote. The route loader awaits
`lazyRemote.preload()` to resolve the component module before rendering. SSR then renders
the component synchronously. Hydration can still load the module lazily in the browser.
Request data stays in each loader result, never in the module cache. Tests assert actual
visibility with JavaScript disabled both before and after remote recovery.

**Server render errors need Suspense fallbacks.** React error boundaries catch errors
after hydration, but do not catch server-render errors. Each module also has a Suspense
boundary whose fallback is an error panel. The explicit SSR React crash is tested without
JavaScript to verify that this fallback is useful before hydration.

**A warm container cache can mask an entry outage.** The cold-start scenario restarts
the host while two remotes are stopped, so cached containers cannot make it pass. The
host uses `shareStrategy: loaded-first`, and its loader records unavailable modules instead
of attempting to render them. Once the remotes return, fresh requests load them again.

The cold-start test sets `MF_OFFLINE_TYPES=1` on the restarted host. This lets development
reuse already downloaded declarations while two type endpoints are intentionally offline;
normal builds and starts retain `abortOnError: true`. It does not enable cold **builds**
without remote types. Production preview uses declarations generated during its prior build.

Fault injection intentionally produces backend abort logs, federation fetch errors, and
render-error logs. Browser tests allow only the explicit render-fault messages and reject
unexpected errors. These diagnostics are evidence of the exercised failures, not silently
suppressed exceptions.

## Artifacts

`test-results/multi-remote-preview.json` and `multi-remote-dev.json` list completed checks.
Screenshots include:

- `multi-ssr-no-javascript.png`: healthy full SSR page.
- `multi-error-panels.png`: isolated orders error beside healthy modules.
- `orders-data-ssr.png`, `orders-timeout-ssr.png`: backend failure fallbacks.
- `react-render-ssr.png`: server-side React crash fallback.
- `host-loader-ssr-error.png`: host route error page.
- `react-browser-render-error.png`: client-side component error boundary.
- `cold-host-two-remotes-offline.png`: cold host with unavailable entries.
- `multi-ssr-recovered.png`: recovered modules visible without JavaScript.

Artifacts are generated locally and excluded from Git. The runner reports a nonzero exit
code if any check fails; a partial JSON report is not evidence that the whole suite passed.

## Handbook navigation and ownership mode

The handbook covers six routes: overview, getting started, Data & SSR, Sessions & writes,
Errors & recovery, and Type safety. A focused browser test checks:

- Example / Code / Tests selection, ArrowRight navigation and Home focus restoration.
- A retained document and ownership setting across client-side topic navigation.
- Host, Catalog, Orders and Warehouse ownership outlines, plus turning the mode off.
- A real React failure followed by recovery, with the host still visible.
- Server-rendered onboarding and contract documentation with JavaScript disabled.
- All six routes at a 390px viewport and the mobile topic menu.

The ownership map is declarative. It shows which application owns an example region;
it does not report live backend health or prove SSR by itself. Existing no-JavaScript tests
continue to verify actual server-rendered content. The Tests view documents commands and
expectations; it does not execute tests in the browser.

## Sessions, contracts, deployment and load

Start at `/guide`, then open chapter 03 (`/scenarios`) after `npm run dev`.
The page pairs four selectable lessons with action/expected-result steps, SSR-highlighted
source excerpts and a live private workspace. Its HTTP activity panel shows actual response
status and time to headers without recording credentials or payloads. An additional E2E
check covers the guide with JavaScript disabled, lesson selection, clipboard content,
backend-denied writes and mobile overflow.

The host selects an Alice/admin or Bob/viewer
demo identity and issues an HttpOnly, SameSite=Lax signed cookie. Only this cookie is
allowlisted for orders, for both SSR and browser forwarding. Orders verifies its signature,
expiry, user and server-owned role and derives ownership from the cookie, not request data.
The selectors bypass a real login provider intentionally; this is an authentication
transport fixture, not deployable identity management.

`OrdersPanel.Workspace` is a second view owned by the same component module. Its own
server functions remain private. Data is stored in a per-user in-memory store in orders.
Create requests use idempotency keys; updates use optimistic versions. Browser loading
uses request sequence numbers so late responses cannot replace current search/page/sort.

| Follow-up area           | Evidence in `tests/advanced.test.ts`                                                                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sessions and isolation   | Missing/invalid session gives 401; viewer writes give 403; Alice and Bob see different SSR data; identity switch and sign-out clear visible data; unrelated cookies and Authorization do not reach orders |
| Mutations                | Invalid titles give 422; double submission/replay creates one item; reload retains it; concurrent stale edits give 409                                                                                    |
| Request races            | A 750 ms old query finishes after a 40 ms new query; late search/page/sort responses never replace the latest result                                                                                      |
| Client navigation        | Real router links preserve the document, Back/Forward restores query state, cross-route remounts work, and authenticated deep links render with JS disabled                                               |
| Independent deployment   | Orders is really rebuilt with changed backend code while host stays alive; old browser and fresh SSR work with the compatible release; changed function IDs fail visibly; restoring v1 recovers           |
| Contract incompatibility | Temporarily adding a required prop to the downloaded declaration makes host `tsc` fail; restoring it passes; an incompatible runtime DTO shows a contract error and recovers                              |
| Partial failures         | Missing browser chunk, missing CSS, manifest available with SSR entry unavailable, dropped backend connection, delayed headers and truncated body are exercised separately                                |
| SSR load                 | 200 authenticated loads at concurrency 10, with per-response user isolation, deadlines, request counters, latency sampling and bounded post-GC memory growth                                              |

The CSS failure deliberately proves graceful loss of styling: the React content remains
visible and the other modules retain their data. It does not pretend that missing CSS
automatically creates an application error panel. Missing JS/SSR entry failures have
their own module fallbacks. A body interrupted after headers can have HTTP 200 yet still
reject the RPC decoder; connection failures and delayed headers produce 502.

The deployment test distinguishes code and data compatibility. Existing host containers
remain cached; compatible handlers can answer old caller IDs. Deliberately changing IDs
does not magically update a loaded host: the page contains an error instead of calling a
different function. Restoration is verified without restarting host. This does not claim
automatic zero-downtime adoption of breaking releases.

The load test is a bounded local regression check, not proof of leak freedom or a capacity
benchmark. It allows 64 MiB heap and 192 MiB RSS growth after a warmup/GC sample and requires
all 200 responses to finish within their deadlines. `load-preview.json` and `load-dev.json`
record the actual counters, memory samples, p50/p95 and budgets. Metrics are available only
when `LAB_TEST_MODE=1`; normal dev does not expose the test metrics endpoint.

## Recorded verification and tooling

On the PR #25 preview branch, `npm run test:multi` and `npm run test:multi:dev`
exercise five concurrent first SSR requests to a fresh host, then the first page
request after each unavailable remote recovers. They check the raw HTML for
hidden React streaming segments and verify remote content with JavaScript disabled.
The same suite checks a browser call to a host-owned server function after federation
initializes. This covers the Rsbuild path. The upstream Vite-only dev fix is outside
the lab's test matrix.

Validated on 2026-11-14 with Node 24.22.1, Rstest / `@rstest/playwright` 0.12.6,
Playwright 1.65.1, Rslint 0.10.1 and the published `@module-federation/tanstack` 0.2.0:

| Command             | Result                                                                |
| ------------------- | --------------------------------------------------------------------- |
| `npm test`          | 3 files, 36 passed, 0 skipped; about 106 seconds including app builds |
| `npm run test:dev`  | 3 files, 35 passed, 1 intentional deployment skip; about 99 seconds   |
| `npm run lint`      | Passed                                                                |
| `npm run typecheck` | Passed for all four apps and the shared session package               |

The latest full production load sample had p50 81.6 ms, p95 120.1 ms and about 2.3 MiB
post-GC heap growth over 200 logical SSR requests. The dev sample had p50 173.8 ms,
p95 420.8 ms and 0.0 MiB positive post-GC heap growth. These are local observations under
different app modes, not a performance comparison or portable benchmark.

The default suite includes `tests/unit.test.ts` (24 cases), `tests/doctor.test.ts`
(13 environment/preflight checks),
`tests/legacy.test.ts` (2 cases covering the original catalog suite and all eleven
multi-remote groups), `tests/advanced.test.ts` (10 cases), and
`tests/coverage-comment.test.ts` (22 checks for report validation, fork PR discovery,
comment updates, pagination and stale-run protection). Production discovers
71 tests; dev runs 70 and explicitly skips the production-artifact deployment case.
The coverage command runs the 59 domain, doctor and comment-publisher tests.

The guide also surfaced an early-interaction race in development: a remote button could
be clicked before its federated handlers attached. Identity and workspace controls now stay
disabled until their component hydrates. Initial data and source examples remain server-rendered.

Rstest uses its Node environment and official `@rstest/playwright` E2E integration, one
worker because the tests own fixed ports, per-test browser contexts, and retained traces
on failures. `rstest list --filesOnly` verifies discovery. `test:unit`, `test:multi`, and
`test:advanced` are focused commands; `npm test` is the complete production run.
Application subprocesses explicitly set their own NODE_ENV: production for build/preview,
development for dev. Inheriting Rstest's NODE_ENV=test produced invalid browser bundles
and is avoided by the explicit subprocess settings.

Rslint 0.10.1 uses recommended JavaScript and TypeScript presets. It excludes dependencies,
build output, generated remote types/routes, diagnostic artifacts and the reference-skills
checkout. Only unused-variable diagnostics are exempted in compile-time negative contract
examples.

## Scope

The suite uses local processes and deterministic data. It tests demo session transport,
cookie allowlisting, private in-memory mutations and compatible/breaking backend rebuilds.
It does not test a production identity provider, database durability, real CDN caching,
mixed React versions or transparent replacement of already loaded host modules.
The shared React version is deliberately identical across all four applications.

## GitHub Actions for external contributions

### Native federation and Node SSR tests

```sh
npm run test:federation
npm run typecheck:federation
```

The dedicated [Rstest configuration](rstest.federation.config.ts) uses the official
`@module-federation/rstest` plugin. Its global setup builds the three real remotes,
then starts catalog and orders production backends on **3404** and **3406**. Node
tests dynamically import `catalog/ServerPanel`, `orders/OrdersPanel` and
`warehouse/WarehousePanel` from their built `remoteEntry.ssr.cjs` containers.
The browser host and Chromium are not needed; teardown stops the fixture processes.

These 16 checks cover:

- Repeated remote imports preserve component identity.
- One Node React renderer renders all three remotes with working hooks.
- Catalog and orders components call their own private server functions through
  `preload`; returned backend data appears in the rendered HTML.
- Concurrent preloads reach independent catalog/orders processes.
- Anonymous requests cannot read the private workspace; Alice and Bob see only
  their own notes, including across ten concurrent SSR request contexts.
- The host forwards the session cookie while dropping unrelated cookies and
  authorization headers.
- Backend failures reject preload, SSR error states render, subsequent requests
  recover, and the plain React render-fault fixture throws to its caller.
- A private server-function module cannot be imported through federation; all
  three manifests expose only their public UI component.

The test host reuses `@module-federation/tanstack/node-entry-loader` to register
the native Node React instance as shared. Both ReactDOM's server renderer and
the remote hooks must use that instance; bundling a fallback React in the test
host can otherwise create a second dispatcher. Dynamic imports let the containers
initialize before use. The plugin enables Rstest's Node federation compatibility
mode automatically; there is no redundant `federation: true` switch.

Preloads run inside `runWithStartContext` with an explicit request fixture and
the same allowlisted-cookie transport as the app host. No remote module or data
RPC is mocked. Server-function modules remain private imports owned by remote UI.
The `remotes.d.ts` declarations provide type-only component contracts from source;
they do not alias runtime imports. Published declaration consumption remains
covered by the app build/typecheck and browser integration suite.

Run this suite separately from other production builds/deployment tests, which
rewrite the same `dist` directories. It uses separate ports from the local demo.
The regular `npm test` / `npm run test:dev` configurations exclude these files
so they are always run through the federation-enabled test host. CI requires the
separate **Federation (Node SSR)** job in addition to the browser integration jobs.

This suite does not add browser/SSR execution to the unit coverage percentage:
it consumes independently compiled production artifacts. See the unit report's
scope below. For API details, see the official
[Rstest guide](https://rstest.rs/guide/advanced/module-federation) and
[Module Federation integration](https://module-federation.io/integrations/build-tool/rstest.html).

### Unit coverage in pull requests

Run `npm run test:coverage` locally. This uses the dedicated
[coverage configuration](rstest.coverage.config.ts) and the matching official
`@rstest/coverage-istanbul` provider. It runs the unit and component suites without starting servers
or interrupting a running demo. `npm run coverage:summary` prints a Markdown report.

Each completed PR CI run creates or updates one **Unit test coverage** bot comment
in the PR conversation. It shows all four percentages, covered/total counts, the
tested commit and a link to the full report. If CI produced no report, the comment
explicitly says coverage is unavailable instead of showing an earlier commit's numbers.
Closed PRs and runs for an outdated head commit are skipped.

The Coverage job checks out the **exact PR base SHA** in a separate directory and
runs that commit's own coverage command with its own lockfile and configuration.
It compares all four percentages in percentage points against the tested checkout
(GitHub's PR merge tree), and intersects added/modified source lines with the
head LCOV executable-line map. The summary includes both commit IDs. Denominators
can change when source or test configuration changes; this is a comparison of
each tree's reported coverage, not an identical-file-only metric.

Changed-line coverage includes TS/TSX/MJS under `apps` and `packages`, excluding
generated declarations and route trees. Non-executable lines do not count.
Source files absent from the unit report are counted separately. A missing or
failed baseline is labelled unavailable; no delta is fabricated. This comparison
is informational and adds no global or changed-line percentage gate.

The bot includes the comparison only while its base SHA still matches the PR's
current base. The comparison publisher must be merged to the default branch
before bot comments gain this section; PR Checks show it immediately. Both base
and head tests run in the read-only CI job. The posting job continues to execute
only default-branch code, validating numeric totals and commit IDs from artifacts.

The coverage command has separate Node logic and jsdom React projects.
`npm run test:components` runs the latter alone: SSR rows are reused without an
extra fetch; status filtering resets pagination; failed refreshes can be retried;
an older slow search cannot overwrite the newest result. Testing Library drives
the real catalog component, table, and shared primitives. A narrowly scoped
alias replaces only its RPC module with a typed Rstest mock, avoiding Start's
build-only virtual modules. These tests do not claim to verify real RPC transport
or CSS; native federation and browser suites cover those boundaries.

Logic tests also cover catalog validation, backend filtering/sorting/pagination,
aggregate statistics, request-context isolation and cleanup, and coverage diff
parsing/validation. Browser integration checks correlate SSR and refreshed catalog
IDs with actual response headers.

Open **Checks → Coverage**, then the workflow run's summary, to see
lines, statements, functions and branches, with a table for every file. Download
the **unit-coverage** artifact and open `index.html` for highlighted uncovered lines.
The artifact also contains `lcov.info` and `coverage-summary.json`, is uploaded even
when tests or thresholds fail if a report was produced, and is retained for 14 days.

The denominator includes all app and shared-package TypeScript/TSX/MJS source,
including files never imported by unit tests and vendored shadcn/ui components.
Generated route trees and declarations are excluded. This is **unit coverage**:
the browser, SSR and backend processes started by E2E tests are not instrumented
by this command. A low aggregate percentage does not mean the integration suite
skipped those behaviors; it means they have no measured unit executions.

Coverage thresholds protect the existing business-logic tests:

| Scope                  | Lines / statements | Functions | Branches |
| ---------------------- | ------------------ | --------- | -------- |
| Session package        | 90%                | 100%      | 85%      |
| Workspace store        | 90%                | 100%      | 90%      |
| Runtime contract guard | 80%                | 100%      | 70%      |

The session threshold is evaluated over the package's MJS files together. There is
no global percentage gate yet; broad unit coverage is still incomplete and is
shown explicitly rather than hidden by excluding UI files. Threshold failures
fail the Coverage job and the required CI gate. Coverage reports stay out of Git.

Tests and report generation use a read-only token. A separate
[Coverage comment workflow](.github/workflows/coverage-comment.yml) runs after CI,
with `actions: read`, `contents: read` and `pull-requests: write` for its posting job.
It checks out only the default branch, installs no project dependencies and never
executes PR code or downloaded files. It reads only validated numeric coverage
totals; GitHub's API supplies the PR identity and current commit. The same flow
handles fork PRs with an empty workflow-run PR association. Comments from users
are never edited, even if they copy the bot's marker.

The comment workflow must first be merged to the default branch to become active.
Subsequent completed PR CI runs will then publish comments automatically. No
external service or repository secret is required. The existing approval policy
for running fork PR tests remains in effect.

[CI](.github/workflows/ci.yml) runs on pull requests and pushes to main. It uses
GitHub-hosted Ubuntu 24.04 runners and Node 24. Quality checks lint and formatting;
the Federation job loads real Node containers and typechecks its test contracts;
separate production/development matrix jobs install Chromium, run the browser suites
and typecheck the generated contracts. The final CI job requires every prerequisite
to succeed and is the required branch check. No path filters skip documentation PRs.

The CI token has contents:read; the separate comment job has the scoped permissions
described above. Actions are SHA-pinned, checkout does not persist credentials,
and setup-node package-manager caching is disabled. There are no deployment steps,
repository secrets or pull_request_target jobs. Failure artifacts
contain local fixture diagnostics and are retained for seven days. Each PR's previous
run is cancelled when superseded. Maintainer approval of external workflows is required
by repository settings, including for repeat contributors.

## Coordinated dependency updates

React and React DOM use the same exact version across all four apps. Start and the
explicit router dependency are aligned to the router version required by Start; otherwise
federated SSR can load distinct router contexts and fail to render the catalog. Dependabot
groups React packages and TanStack packages so related updates can be validated together.
The integration branch for PRs #5–#9 preserves their commits and regenerates the lockfile
from the combined workspace manifests, retaining the merged security updates.
