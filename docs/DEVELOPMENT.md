# Development reference

[Documentation home](../README.md) · [Walkthrough](WALKTHROUGH.md) · [Architecture](ARCHITECTURE.md) · [Test matrix](../TESTING.md)

## Requirements and lifecycle

Use Node 22 (22.18+), Node 24 (24.11+), or Node 26+, with npm workspaces.
All four apps pin `@module-federation/tanstack` to the published npm version `0.2.0`.
The lockfile records the registry tarball and integrity hash. Run commands from the
repository root unless a workspace is specified.

```sh
npm ci
npm run build
npm run dev
```

Build compiles all remotes, starts temporary remote previews, and builds the host while
it downloads their generated declarations. It then stops those temporary previews.
Dev starts the remotes, waits for their manifests, then starts host. Preview uses built
artifacts. These modes share fixed ports and must run separately.

Stop the orchestrator with Ctrl+C. It owns and cleans up the child processes it started;
a remote exiting also ends the orchestrated session. For intentional manual outages,
run separate workspace terminals instead.

## Command reference

| Command                                         | Purpose                                                                                                          |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                        | Install locked dependencies and link local workspaces.                                                           |
| `npm run build`                                 | Build all remotes, generate declarations and build host.                                                         |
| `npm run dev`                                   | Start all four apps with development builds.                                                                     |
| `npm run preview`                               | Start all four apps from existing production artifacts.                                                          |
| `npm run typecheck`                             | Check all app workspaces and the shared session package.                                                         |
| `npm run lint` / `npm run lint:fix`             | Check/fix supported Rslint rules.                                                                                |
| `npm run format:check` / `npm run format`       | Check/write repository formatting.                                                                               |
| `npm run test:unit`                             | Run 24 focused tests without starting apps.                                                                      |
| `npm test`                                      | Build and run all production Rstest tests.                                                                       |
| `npm run test:dev`                              | Run the complete development suite, with the production deployment case skipped.                                 |
| `npm run test:multi` / `npm run test:multi:dev` | Run original catalog and multi-remote regression groups.                                                         |
| `npm run test:advanced`                         | Run session, mutation, failure, contract, load, deployment and handbook E2E checks against production artifacts. |

Install the E2E browser once with `npx playwright install chromium`.
Free application ports 3004–3007 and test proxy port 3016 before process-owned E2E runs.
See [TESTING.md](../TESTING.md) for runner behavior and artifact locations.

## Run one app at a time

After the initial build, open a separate terminal for each command. Start the three
remotes before the host so their manifest and type endpoints are available.

```sh
# Terminal 1 — catalog
npm run dev --workspace @lab/remote

# Terminal 2 — orders and private notes
npm run dev --workspace @lab/orders

# Terminal 3 — plain React warehouse
npm run dev --workspace @lab/react-remote

# Terminal 4 — host
npm run dev --workspace @lab/host
```

Stopping orders now leaves the other terminals running. Browser requests can show the
failure and retry after orders restarts. Restarting orders resets private notes and
idempotency records; signing out alone does not reset that store.

## Configuration

The default app needs no environment file. These variables are explicit local fixture
controls, rather than a production deployment interface.

| Variable                 | Default / owner                                  | Effect                                                                                                                                  |
| ------------------------ | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `LAB_SESSION_SECRET`     | Built-in local-only signing key; host and orders | Override the shared signing key. Both processes must use the same value. Existing cookies fail verification after a change.             |
| `ORDERS_INTERNAL_ORIGIN` | `http://127.0.0.1:3006`; host                    | Change orders' forwarding destination. The tests route it through the local fault proxy on 3016.                                        |
| `MF_OFFLINE_TYPES`       | Unset; host build/dev config                     | Set to `1` only to reuse already downloaded types while a type endpoint is deliberately offline. It does not replace the initial build. |
| `LAB_TEST_MODE`          | Unset; test infrastructure                       | Set to `1` by the test runner to enable request metrics and GC instrumentation. Normal dev does not expose the metrics endpoint.        |
| `LAB_CONTRACT_VERSION`   | `v1`; orders runtime                             | Simulate an incompatible workspace DTO version for recovery tests.                                                                      |
| `LAB_RELEASE`            | `v1`; orders build                               | Stamp the release identifier into built code; the deployment test rebuilds orders with different values.                                |
| `LAB_FUNCTION_EPOCH`     | Unset; orders build                              | Deliberately change generated function IDs for the breaking-deployment test.                                                            |
| `LAB_RUNTIME`            | Set by `scripts/test.mjs`                        | Select the test fixture's dev or preview runtime. Prefer the npm scripts.                                                               |
| `LAB_SKIP_BUILD`         | Unset; test fixture                              | Reuse existing production artifacts for diagnostics. Prefer a normal full run for validation.                                           |

The test runner supplies its own deterministic session secret. The process launcher sets
`NODE_ENV=development` for dev and `NODE_ENV=production` for build/preview, independent
of the test runner's own environment.

## Source map

| Area                                               | Files                                                                                                                                                                                               |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared handbook and ownership mode                 | [HandbookShell.tsx](../apps/host/src/components/HandbookShell.tsx), [ChapterWorkbench.tsx](../apps/host/src/components/ChapterWorkbench.tsx)                                                        |
| Chapter examples and guided lessons                | [chapters.ts](../apps/host/src/chapters.ts), [lessons.ts](../apps/host/src/lessons.ts)                                                                                                              |
| Host SSR routes                                    | [routes](../apps/host/src/routes)                                                                                                                                                                   |
| Forwarding, CSRF integration and test-only metrics | [start.ts](../apps/host/src/start.ts), [host-metrics.ts](../apps/host/src/host-metrics.ts)                                                                                                          |
| SSR component cache and error boundaries           | [ssr-remote.tsx](../apps/host/src/components/ssr-remote.tsx), [RemoteBoundary.tsx](../apps/host/src/components/RemoteBoundary.tsx)                                                                  |
| Catalog component and private function             | [ServerPanel.tsx](../apps/remote/src/components/ServerPanel.tsx), [server-functions.ts](../apps/remote/src/server-functions.ts)                                                                     |
| Orders and private notes UI                        | [OrdersPanel.tsx](../apps/orders/src/components/OrdersPanel.tsx), [WorkspacePanel.tsx](../apps/orders/src/components/WorkspacePanel.tsx)                                                            |
| Private authorization, store and DTO checks        | [workspace-functions.ts](../apps/orders/src/workspace-functions.ts), [workspace-store.ts](../apps/orders/src/workspace-store.ts), [workspace-contract.ts](../apps/orders/src/workspace-contract.ts) |
| Plain React component                              | [WarehousePanel.tsx](../apps/react-remote/src/WarehousePanel.tsx)                                                                                                                                   |
| Session signing and cookie allowlist               | [packages/lab-session](../packages/lab-session)                                                                                                                                                     |
| Build/process lifecycle                            | [scripts/lab.mjs](../scripts/lab.mjs), [scripts/processes.mjs](../scripts/processes.mjs)                                                                                                            |
| Rstest configuration and fixtures                  | [rstest.config.ts](../rstest.config.ts), [tests/test-lab.mjs](../tests/test-lab.mjs), [tests/fault-proxy.mjs](../tests/fault-proxy.mjs)                                                             |
| Shared styling and editable primitives             | [apps/theme.css](../apps/theme.css), [host UI](../apps/host/src/components/ui), [catalog UI](../apps/remote/src/components/ui)                                                                      |

## Generated files and dependencies

`dist/`, downloaded `@mf-types/`, federation caches, test reports and traces are not
committed. Generated route trees are present in the source tree; let Start regenerate
them when adding or moving routes. Never hand-edit downloaded remote declarations for
application development; the contract test changes one temporarily and restores it.

After changing a remote contract, rebuild so the host consumes current declarations,
then run `npm run typecheck`. The negative compile-time examples should continue to
reject invalid props, loader inputs and DTOs. Runtime DTO validation remains a separate
responsibility for independently deployed backends.

Tracked text files use LF line endings through `.gitattributes`, including on Windows.
This keeps a clean checkout compatible with the repository formatting check.

The dependency versions are intentionally pinned by the lockfile for this reference.
When updating the federation/Start packages, rerun both production and dev verification;
function IDs, streaming behavior and type generation are part of the exercised surface.

## Troubleshooting

| Symptom                                                       | What to check                                                                                                                                                                                         |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Port already in use                                           | Stop the existing dev/preview/test session that owns 3004–3007 or 3016. Avoid running two orchestrators together.                                                                                     |
| Host cannot resolve a remote import or downloaded declaration | Run the first root build; verify every remote manifest/type endpoint is reachable. Keep the default fail-on-type-download-error behavior.                                                             |
| Dev type-hint download warning                                | The plugin's dynamic hint URLs can differ from the normal manifest type endpoint. Verify the root build and typecheck; the downloaded archives and contract checks are the authoritative checks here. |
| Remote works standalone but host fails                        | Check the matching manifest name, expose name, server container and namespaced forwarding configuration. Inspect the error panel and backend identity.                                                |
| A remote markup edit causes a dev hydration mismatch          | Restart the host after the remote is rebuilt so its cached SSR component code matches the browser container, then reload. Backend recovery tests separately cover restarting a compatible remote.     |
| Notes disappear after an edit                                 | Check the active search and page. The new title may not match; use Show all notes or Clear.                                                                                                           |
| Cookie no longer works                                        | Select the identity again. Sessions expire after ten minutes or fail when host and orders use different signing keys.                                                                                 |
| HTTP 200 with an application error                            | Start can serialize handler exceptions in a successful transport response. Inspect the caller's error and DTO validation, not only the status code.                                                   |
| A changed function ID fails against an old host               | Cached caller code does not automatically adopt a breaking release. Restore compatibility or deploy a coordinated update.                                                                             |

Fault tests intentionally produce aborts, render errors and federation-fetch diagnostics.
A successful run still requires every assertion and the runner exit code to pass; a
partial artifact or an expected error log is not a substitute for the final report.
