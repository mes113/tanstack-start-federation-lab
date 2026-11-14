import { ChapterWorkbench } from "../components/ChapterWorkbench";
import { BoundaryFrame } from "../components/HandbookShell";
import { sessionChapter } from "../chapters";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import type OrdersPanel from "orders/OrdersPanel";
import { ssrRemote } from "../components/ssr-remote";
import { getDemoIdentity, selectDemoIdentity } from "../session-functions";
import { CodeExample } from "../components/CodeExample";
import { lessons } from "../lessons";
import { ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

const remote = ssrRemote(async () => ({
  default: (await import("orders/OrdersPanel")).default.Workspace,
}));
const Workspace = remote.Component;
type WorkspaceData = ComponentProps<
  typeof OrdersPanel.Workspace
>["initialData"];
export const Route = createFileRoute("/scenarios")({
  validateSearch: (search: Record<string, unknown>) => ({
    query: typeof search.query === "string" ? search.query.slice(0, 80) : "",
    page:
      Number.isInteger(Number(search.page)) && Number(search.page) >= 0
        ? Math.min(50, Number(search.page))
        : 0,
    sort: search.sort === "desc" ? ("desc" as const) : ("asc" as const),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const actor = await getDemoIdentity();
    let initialData: WorkspaceData = null;
    let initialError = "";
    try {
      await remote.load();
      const module = await import("orders/OrdersPanel");
      initialData = await module.default.preloadWorkspace({
        ...deps,
        delayMs: 40,
      });
    } catch (error) {
      initialError = actor
        ? error instanceof Error
          ? error.message
          : "Workspace unavailable"
        : "Sign in to view your workspace.";
    }
    return {
      actor,
      initialData,
      initialError,
      query: deps.query,
      page: deps.page,
      sort: deps.sort,
    };
  },
  component: Scenarios,
});
function Scenarios() {
  const data = Route.useLoaderData();
  const router = useRouter();
  const [sessionError, setSessionError] = useState("");
  const [switching, setSwitching] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [lessonId, setLessonId] =
    useState<(typeof lessons)[number]["id"]>("sessions");
  const lesson = lessons.find((item) => item.id === lessonId)!;
  async function select(user: "alice" | "bob" | "logout") {
    setSwitching(true);
    setSessionError("");
    try {
      await selectDemoIdentity({ data: user });
      await router.invalidate();
    } catch {
      setSessionError("Could not change demo identity.");
    } finally {
      setSwitching(false);
    }
  }
  return (
    <main className="learn-page" id="demo-content">
      <div className="lab-topbar">
        <Link to="/lab" search={{ fault: "none" }}>
          ← SSR workspace
        </Link>
        <Link to="/">Product catalog</Link>
      </div>
      <ChapterWorkbench {...sessionChapter}>
        <div className="learn-layout">
          <aside className="learn-sidebar">
            <span>FOUR SHORT LESSONS</span>
            <nav aria-label="Hands-on lessons">
              {lessons.map((item) => (
                <button
                  key={item.id}
                  aria-pressed={lessonId === item.id}
                  onClick={() => setLessonId(item.id)}
                >
                  <small>{item.number}</small>
                  <strong>{item.short}</strong>
                  <ArrowRight size={13} />
                </button>
              ))}
            </nav>
            <div className="learn-sidebar-note">
              <ShieldCheck size={19} />
              <p>
                Real requests.
                <br />
                Real backend decisions.
                <br />
                Local demo identities.
              </p>
            </div>
          </aside>
          <div className="learn-body">
            <section className="learn-lesson" aria-live="polite">
              <span className="learn-section-label">WHAT YOU ARE TESTING</span>
              <h2>{lesson.question}</h2>
              <p>{lesson.summary}</p>
              <ol>
                {lesson.steps.map((step, index) => (
                  <li key={step.action}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.action}</strong>
                      <p>
                        <CheckCircle2 size={13} />
                        {step.expect}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <div className="learn-example-heading">
              <div>
                <span className="learn-section-label">YOUR LIVE EXAMPLE</span>
                <h2>Host identity → remote-owned data</h2>
              </div>
              <span className="learn-live-pill">
                <span />
                Interactive
              </span>
            </div>
            <BoundaryFrame owner="Host">
              <section className="learn-identity">
                <div className="learn-identity-heading">
                  <strong>1. Choose who is making the request</strong>
                  <span>Host · :3005</span>
                </div>
                <div className="identity-buttons">
                  <button
                    aria-label="Use Alice (admin)"
                    aria-pressed={data.actor?.user === "alice"}
                    disabled={!hydrated || switching}
                    onClick={() => void select("alice")}
                  >
                    <span className="identity-avatar alice">A</span>
                    <span>
                      <strong>Use Alice (admin)</strong>
                      <small>Read, create and edit her own items</small>
                    </span>
                  </button>
                  <button
                    aria-label="Use Bob (viewer)"
                    aria-pressed={data.actor?.user === "bob"}
                    disabled={!hydrated || switching}
                    onClick={() => void select("bob")}
                  >
                    <span className="identity-avatar bob">B</span>
                    <span>
                      <strong>Use Bob (viewer)</strong>
                      <small>Read his own items; writes return 403</small>
                    </span>
                  </button>
                </div>
                <div className="identity-current">
                  <span>
                    {switching ? "Changing identity…" : "Current identity:"}{" "}
                    <strong data-testid="session-user">
                      {data.actor?.user ?? "guest"}
                    </strong>
                  </span>
                  <button
                    disabled={!hydrated || switching}
                    onClick={() => void select("logout")}
                  >
                    Sign out
                  </button>
                </div>
                <p className="identity-disclaimer">
                  These buttons issue local demo cookies. There is no external
                  login provider.
                </p>
              </section>
            </BoundaryFrame>
            {sessionError && <p role="alert">{sessionError}</p>}
            <nav
              className="lab-scenarios learn-saved-views"
              aria-label="URL-backed views"
            >
              <span>Try a shareable route:</span>
              <Link
                to="/scenarios"
                search={{ query: "private", page: 0, sort: "asc" }}
              >
                Saved search
              </Link>
              <Link
                to="/scenarios"
                search={{ query: "", page: 0, sort: "desc" }}
              >
                Descending view
              </Link>
            </nav>
            <BoundaryFrame owner="Orders">
              <Workspace
                lesson={lessonId}
                key={`${data.actor?.user ?? "guest"}:${data.query}:${data.page}:${data.sort}`}
                initialData={data.initialData}
                initialError={data.initialError}
                initialQuery={data.query}
                initialPage={data.page}
                initialSort={data.sort}
              />
            </BoundaryFrame>
          </div>
          <aside className="learn-reference">
            <CodeExample
              key={lesson.id}
              code={lesson.code}
              file={lesson.file}
              title={lesson.codeTitle}
            />
            <div className="learn-takeaway">
              <span>THE IMPORTANT BIT</span>
              <p>{lesson.takeaway}</p>
            </div>
            <div className="learn-test-command">
              <span>VERIFY IT AUTOMATICALLY</span>
              <code>npm run test:advanced</code>
              <p>
                Runs the guided flows plus deployment, contract, partial-failure
                and load checks.
              </p>
            </div>
          </aside>
        </div>
      </ChapterWorkbench>
    </main>
  );
}
