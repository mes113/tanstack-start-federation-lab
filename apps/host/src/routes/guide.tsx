import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Layers3,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { BoundaryFrame } from "../components/HandbookShell";
import { ArchitectureMap } from "../components/ArchitectureMap";
import { CodeExample } from "../components/CodeExample";

export const Route = createFileRoute("/guide")({
  head: () => ({
    meta: [
      { title: "Start here · Federation Lab" },
      {
        name: "description",
        content:
          "Learn federated SSR, remote server functions and session forwarding with runnable examples.",
      },
    ],
  }),
  component: Guide,
});
function Guide() {
  return (
    <main className="guide-page" id="demo-content">
      <section className="guide-hero">
        <div className="guide-intro">
          <span className="guide-eyebrow">LEARN BY RUNNING THE REAL THING</span>
          <h1>
            Microfrontends.
            <br />
            One server-rendered page.
          </h1>
          <p>
            An interactive guide to TanStack Start, Module Federation and
            Rsbuild. Follow a request, change a session, break a remote — then
            see the code that makes it work.
          </p>
          <div className="guide-hero-actions">
            <Link
              to="/scenarios"
              search={{ query: "", page: 0, sort: "asc" }}
              className="guide-primary"
            >
              Start a guided lesson <ArrowRight size={16} />
            </Link>
            <a href="#learning-path" className="guide-secondary">
              Explore the examples ↓
            </a>
          </div>
          <div className="guide-stack">
            <span>TanStack Start</span>
            <span>Module Federation</span>
            <span>Rsbuild</span>
            <span>Rstest + Rslint</span>
          </div>
        </div>
        <BoundaryFrame owner="Host">
          <ArchitectureMap />
        </BoundaryFrame>
      </section>
      <section className="guide-learning" id="learning-path">
        <div className="guide-section-heading">
          <span className="guide-eyebrow">YOUR LEARNING PATH</span>
          <h2>A learning path through the whole system.</h2>
          <p>
            Each chapter pairs a working application with a concrete question to
            investigate.
          </p>
        </div>
        <div className="guide-chapters">
          <Link to="/getting-started" className="guide-chapter">
            <span className="guide-chapter-number">01 / GETTING STARTED</span>
            <Terminal size={25} />
            <h3>Run your first federated page</h3>
            <p>
              Set up the reference app. Connect a component, its preload and the
              host transport.
            </p>
            <span className="guide-chapter-outcome">
              Start: setup → configuration → first request
            </span>
            <strong>
              Get started <ArrowUpRight size={16} />
            </strong>
          </Link>
          <Link to="/" className="guide-chapter">
            <span className="guide-chapter-number">02 / DATA & SSR</span>
            <Layers3 size={25} />
            <h3>A remote that owns its data</h3>
            <p>
              Use the catalog table. See which data arrives in the first HTML
              and what changes after hydration.
            </p>
            <span className="guide-chapter-outcome">
              Learn: SSR → hydration → browser RPC
            </span>
            <strong>
              Explore Data & SSR <ArrowUpRight size={16} />
            </strong>
          </Link>
          <Link
            to="/scenarios"
            search={{ query: "", page: 0, sort: "asc" }}
            className="guide-chapter"
          >
            <span className="guide-chapter-number">03 / SESSIONS & WRITES</span>
            <ShieldCheck size={25} />
            <h3>One session across app boundaries</h3>
            <p>
              Try private notes, viewer permissions, safe retries and
              out-of-order searches.
            </p>
            <span className="guide-chapter-outcome">
              Learn: credentials → access → mutations
            </span>
            <strong>
              Open Sessions & writes <ArrowUpRight size={16} />
            </strong>
          </Link>
          <Link to="/lab" search={{ fault: "none" }} className="guide-chapter">
            <span className="guide-chapter-number">04 / ERRORS & RECOVERY</span>
            <Braces size={25} />
            <h3>Independent modules. Shared page.</h3>
            <p>
              Compose three remotes, including plain React. Break one boundary
              and recover it.
            </p>
            <span className="guide-chapter-outcome">
              Learn: composition → isolation → recovery
            </span>
            <strong>
              Explore Errors & recovery <ArrowUpRight size={16} />
            </strong>
          </Link>
          <Link to="/types" className="guide-chapter">
            <span className="guide-chapter-number">05 / TYPE SAFETY</span>
            <Layers3 size={25} />
            <h3>Remote code. Local feedback.</h3>
            <p>
              Understand generated declarations, typed component props and
              runtime DTO validation.
            </p>
            <span className="guide-chapter-outcome">
              Learn: types → compatibility → validation
            </span>
            <strong>
              Inspect Type safety <ArrowUpRight size={16} />
            </strong>
          </Link>
          <a href="#source-map" className="guide-chapter">
            <span className="guide-chapter-number">KEEP EXPLORING</span>
            <Terminal size={25} />
            <h3>Go from the lesson to the source</h3>
            <p>
              Each topic has Example, Code and Tests views. Follow the source
              map to make the example your own.
            </p>
            <span className="guide-chapter-outcome">
              Build on a working reference
            </span>
            <strong>
              Find the implementation <ArrowUpRight size={16} />
            </strong>
          </a>
        </div>
      </section>
      <section className="guide-bottom">
        <div>
          <span className="guide-eyebrow">REPRODUCE IT LOCALLY</span>
          <h2>Run it. Read it. Change it.</h2>
          <p>
            The host is a shell. Each remote owns its UI, and each TanStack
            backend owns its functions. Federation exposes component modules,
            never raw server functions.
          </p>
          <div className="guide-scope">
            <strong>Know the demo boundaries</strong>
            <p>
              Alice and Bob are local test identities. Writes are in memory and
              reset with the orders process. Breaking function-ID changes
              require a compatible deployment plan.
            </p>
          </div>
        </div>
        <CodeExample
          title="Run the full reference suite"
          file="Repository root · Node 22.18+ or 24.11+"
          code={`npm ci
npm run build
npm run dev

# Stop dev before running process-owned tests.
npx playwright install chromium
npm test
npm run test:dev
npm run typecheck
npm run lint`}
        />
      </section>
      <section className="guide-source-map" id="source-map">
        <div className="guide-section-heading">
          <span className="guide-eyebrow">FIND YOUR WAY THROUGH THE CODE</span>
          <h2>A small map of the repository.</h2>
        </div>
        <div className="source-map-grid">
          {[
            [
              "Host & forwarding",
              "apps/host/src/start.ts",
              "Allowlist credentials and forward namespaced calls.",
            ],
            [
              "Catalog remote",
              "apps/remote/src/components/ServerPanel.tsx",
              "A table and its component-owned SSR preload.",
            ],
            [
              "Sessions & writes",
              "apps/orders/src/components/WorkspacePanel.tsx",
              "Real requests, mutation keys and sequence guards.",
            ],
            [
              "Remote authorization",
              "apps/orders/src/workspace-functions.ts",
              "Verify identity and enforce access on the backend.",
            ],
            [
              "Plain React",
              "apps/react-remote/src/WarehousePanel.tsx",
              "A frameworkless component rendered inside the host.",
            ],
            [
              "Reproducible checks",
              "tests/advanced.test.ts",
              "Focused E2E scenarios, including real rebuilds.",
            ],
          ].map(([title, path, description]) => (
            <div key={title}>
              <Terminal size={16} />
              <h3>{title}</h3>
              <code>{path}</code>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="guide-footer">
        <span>Built to explain the boundaries, not hide them.</span>
        <a
          href="https://github.com/mes113/tanstack-start-federation-lab"
          target="_blank"
          rel="noreferrer"
        >
          Browse the repository <ArrowUpRight size={14} />
        </a>
      </footer>
    </main>
  );
}
