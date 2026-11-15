import { createFileRoute, Link } from "@tanstack/react-router";
import { ChapterWorkbench } from "../components/ChapterWorkbench";
import { CodeExample } from "../components/CodeExample";
export const Route = createFileRoute("/getting-started")({
  component: GettingStarted,
});
function GettingStarted() {
  return (
    <main className="handbook-page" id="demo-content">
      <ChapterWorkbench
        number="01 / GETTING STARTED"
        title="From checkout to a federated page."
        description="Run the reference app, then connect what you see to the host and remote configuration."
        question="What is the smallest path from host to remote-owned data?"
        expected="The host loads a component module, calls its preload, and renders its data. The remote's server functions stay private."
        file="apps/host/rsbuild.config.ts"
        code={`// Inside tanstackStartModuleFederation({ federation: … })
name: "host",
remotes: {
  catalog: "catalog@http://127.0.0.1:3004/mf-manifest.json",
},
dts: {
  generateTypes: false,
  consumeTypes: { typesOnBuild: true, abortOnError: true },
},
// See the file for imports, shared dependencies and other remotes.
// The remote exposes ./ServerPanel, never ./server-functions.`}
        command={
          "npm run typecheck\nnpm run lint\nnpx playwright install chromium\nnpm test"
        }
        checks={[
          "Build generates route trees and remote type declarations.",
          "Each remote exposes one component module with a component-owned preload.",
          "The host renders remote data and forwards later browser calls.",
        ]}
      >
        <div className="getting-started-grid">
          <section>
            <span className="guide-eyebrow">01 · RUN THE REFERENCE</span>
            <h2>Start all four apps.</h2>
            <p>
              Use Node 22.18+ or 24.11+ and npm. The first build prepares the
              remote containers and generated types.
            </p>
            <CodeExample
              title="Clone, build and start"
              file="Repository root"
              code={`git clone https://github.com/mes113/tanstack-start-federation-lab.git
cd tanstack-start-federation-lab
npm ci
npm run doctor
npm run build
npm run dev`}
            />
            <p>
              Already in this repository? Start at <code>npm ci</code>. Dev
              starts the remotes before the host.
            </p>
            <p>
              Something did not start? Run <code>npm run doctor</code> for
              dependency, Node and port checks. For preview or tests, use{" "}
              <code>npm run doctor -- --mode preview</code> or{" "}
              <code>--mode test</code>.
            </p>
          </section>
          <section>
            <span className="guide-eyebrow">02 · FOLLOW ONE REQUEST</span>
            <h2>Open the catalog.</h2>
            <ol className="setup-steps">
              <li>
                <strong>Request the host page.</strong>
                <p>
                  The route loader imports catalog/ServerPanel and calls its
                  preload method.
                </p>
              </li>
              <li>
                <strong>Read the first HTML.</strong>
                <p>
                  Eight product rows are already rendered. Hydration reuses that
                  data.
                </p>
              </li>
              <li>
                <strong>Search for a product.</strong>
                <p>
                  The remote component calls its own server function through the
                  host namespace.
                </p>
              </li>
            </ol>
            <Link className="guide-primary" to="/">
              Try Data & SSR →
            </Link>
            <div className="guide-scope">
              <strong>Local reference, clear boundaries</strong>
              <p>
                Ports 3004–3007 must be free. Stop dev before running the
                process-owned browser tests. Demo users and in-memory writes are
                fixtures.
              </p>
            </div>
          </section>
        </div>
        <section className="chapter-reading setup-files">
          <h2>Three places to start reading</h2>
          <div className="setup-file-grid">
            <div>
              <strong>Connect the containers</strong>
              <code>apps/host/rsbuild.config.ts</code>
              <p>Remote manifests, shared runtime and generated types.</p>
            </div>
            <div>
              <strong>Own the component and data</strong>
              <code>apps/remote/src/components/ServerPanel.tsx</code>
              <p>Table UI, private function calls and SSR preload.</p>
            </div>
            <div>
              <strong>Forward browser calls</strong>
              <code>apps/host/src/start.ts</code>
              <p>Namespaced transport and allowlisted credentials.</p>
            </div>
          </div>
        </section>
      </ChapterWorkbench>
    </main>
  );
}
