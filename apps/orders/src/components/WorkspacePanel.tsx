import {
  FileText,
  Plus,
  RefreshCw,
  Search,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  loadWorkspace,
  createWorkspaceItem,
  updateWorkspaceItem,
} from "../workspace-functions";
import {
  parseWorkspaceSnapshot,
  type WorkspaceSnapshot,
} from "../workspace-contract";

export interface WorkspacePanelProps {
  lesson?: "sessions" | "mutations" | "races" | "navigation";
  initialData: WorkspaceSnapshot | null;
  initialError?: string;
  initialQuery: string;
  initialPage: number;
  initialSort: "asc" | "desc";
}
export default function WorkspacePanel({
  lesson = "sessions",
  initialData,
  initialError,
  initialQuery,
  initialPage,
  initialSort,
}: WorkspacePanelProps) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(initialPage);
  const [sort, setSort] = useState(initialSort);
  const [title, setTitle] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    initialError ?? (initialData ? "" : "Sign in to view your workspace."),
  );
  const [pending, setPending] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [activity, setActivity] = useState<
    {
      id: number;
      operation: string;
      method: string;
      path: string;
      origin: string;
      status: number | null;
      duration: number;
    }[]
  >([]);
  const httpSequence = useRef(0);
  const newestRead = useRef(0);
  const sequence = useRef(0);
  const requestId = useRef("");
  const lastCreate = useRef<{ title: string; requestId: string } | null>(null);
  useEffect(() => {
    setHydrated(true);
    return () => {
      sequence.current++;
    };
  }, []);
  function observedFetch(operation: string): typeof globalThis.fetch {
    return async (input, init) => {
      const id = ++httpSequence.current;
      if (operation === "Read items") newestRead.current = id;
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href,
      );
      const start = performance.now();
      const record = (status: number | null) =>
        setActivity((previous) =>
          [
            {
              id,
              operation,
              method: init?.method ?? "GET",
              path: url.pathname,
              origin: url.host,
              status,
              duration: Math.round(performance.now() - start),
            },
            ...previous,
          ].slice(0, 3),
        );
      try {
        const response = await globalThis.fetch(input, init);
        record(response.status);
        return response;
      } catch (cause) {
        record(null);
        throw cause;
      }
    };
  }
  async function refresh(
    nextQuery = query,
    nextPage = page,
    nextSort = sort,
    delayMs = 40,
  ) {
    const current = ++sequence.current;
    setPending(true);
    setError("");
    try {
      const snapshot = parseWorkspaceSnapshot(
        await loadWorkspace({
          data: { query: nextQuery, page: nextPage, sort: nextSort, delayMs },
          fetch: observedFetch("Read items"),
        }),
      );
      if (sequence.current === current) setData(snapshot);
    } catch (cause) {
      if (sequence.current === current)
        setError(
          cause instanceof Error ? cause.message : "Workspace request failed.",
        );
    } finally {
      if (sequence.current === current) setPending(false);
    }
  }
  async function create(replay = false) {
    if (pending) return;
    const input = replay
      ? lastCreate.current
      : { title, requestId: requestId.current || crypto.randomUUID() };
    if (!input) return;
    requestId.current = input.requestId;
    lastCreate.current = input;
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await createWorkspaceItem({
        data: input,
        fetch: observedFetch("Create item"),
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(`Saved “${result.note.title}”.`);
      requestId.current = "";
      await refresh();
    } catch {
      setError("Save failed. Retry with the same request ID.");
    } finally {
      setPending(false);
    }
  }
  async function update(id: string) {
    const note = data?.notes.find((note) => note.id === id);
    if (!note) return;
    setPending(true);
    setError("");
    try {
      const result = await updateWorkspaceItem({
        data: {
          id: note.id,
          title: edits[id] ?? note.title,
          version: note.version,
        },
        fetch: observedFetch("Update item"),
      });
      if (!result.ok) setError(result.message);
      else {
        setMessage(`Saved changes to “${result.note.title}”.`);
        await refresh();
      }
    } catch {
      setError("Update failed. Refresh before trying again.");
    } finally {
      setPending(false);
    }
  }
  const hints = {
    sessions:
      "Add a note as Alice. Then switch to Bob and try again — the remote will block his write.",
    mutations:
      "Add a note, then repeat the same save below. The list should contain just one copy.",
    races:
      "Type a single letter, then quickly enter a full word. The latest search should win.",
    navigation:
      "Open a saved view above, then reload. These notes should already be in the HTML.",
  };
  const lastResponse = activity[0];
  return (
    <section
      className="lab-card notes-app"
      data-testid="private-workspace"
      aria-busy={pending}
    >
      <header className="notes-header">
        <div className="notes-heading">
          <span className="notes-icon">
            <FileText size={20} />
          </span>
          <div>
            <span className="notes-label">PRIVATE NOTES</span>
            <h2 data-testid="workspace-owner">
              {data ? `${data.actor.user}'s workspace` : "Private workspace"}
            </h2>
          </div>
        </div>
        <span className="notes-permission">
          {data?.actor.role === "admin"
            ? "Can edit"
            : data
              ? "Read only"
              : "Signed out"}
        </span>
      </header>
      <p className="notes-experiment">{hints[lesson]}</p>
      <form
        className="notes-compose"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <label htmlFor="note-title">Add a private note</label>
        <div>
          <input
            id="note-title"
            disabled={!hydrated}
            aria-label="New note"
            placeholder="e.g. Review the remote component"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              requestId.current = "";
            }}
          />
          <button
            className="notes-primary"
            disabled={!hydrated || pending}
            type="submit"
          >
            <Plus size={14} />
            Add note
          </button>
        </div>
        <small>
          {data?.actor.role === "viewer"
            ? "Bob can read his notes. Try adding one to see the permission check."
            : "Visible only to the selected user. Use 3–80 characters."}
        </small>
      </form>
      {error && (
        <div
          className="notes-feedback error"
          role="alert"
          data-testid="private-error"
        >
          {error}
        </div>
      )}
      {message && (
        <p
          className="notes-feedback success"
          role="status"
          data-testid="mutation-result"
        >
          <CheckCircle2 size={14} />
          {message}
        </p>
      )}
      <div className="notes-list-heading">
        <strong>
          Your notes <span>{data?.total ?? 0}</span>
        </strong>
        <button disabled={!hydrated} onClick={() => void refresh()}>
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>
      <div className="notes-search">
        <Search size={14} />
        <input
          disabled={!hydrated}
          aria-label="Search notes"
          placeholder="Search your notes…"
          value={query}
          onChange={(event) => {
            const next = event.target.value;
            setQuery(next);
            setPage(0);
            void refresh(next, 0, sort, next.length === 1 ? 750 : 40);
          }}
        />
        {query && (
          <button
            disabled={!hydrated}
            onClick={() => {
              setQuery("");
              setPage(0);
              void refresh("", 0, sort);
            }}
          >
            Clear
          </button>
        )}
      </div>
      <ul className="notes-list">
        {data?.notes.map((note) => (
          <li key={note.id} data-testid="private-item">
            <div className="notes-row">
              <FileText size={15} />
              <strong>{note.title}</strong>
              <span>v{note.version}</span>
            </div>
            <details className="notes-edit">
              <summary>
                Edit this note <ChevronRight size={12} />
              </summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void update(note.id);
                }}
              >
                <label className="workspace-field">
                  <span>New title</span>
                  <input
                    disabled={!hydrated}
                    aria-label="Edit note title"
                    placeholder={note.title}
                    value={edits[note.id] ?? note.title}
                    onChange={(event) =>
                      setEdits((previous) => ({
                        ...previous,
                        [note.id]: event.target.value,
                      }))
                    }
                  />
                </label>
                <button
                  className="notes-primary"
                  disabled={!hydrated || pending}
                  type="submit"
                >
                  Save changes
                </button>
              </form>
              <small>
                The saved version is checked by the remote. An outdated edit
                returns 409.
              </small>
              <code>
                {note.id} · v{note.version}
              </code>
            </details>
          </li>
        ))}
      </ul>
      {!data ? (
        <div className="notes-empty">
          <FileText size={24} />
          <strong>Choose Alice or Bob above</strong>
          <p>The remote will load that user's private notes.</p>
        </div>
      ) : data.notes.length === 0 ? (
        <div className="notes-empty">
          <Search size={24} />
          <strong>
            {query ? `No notes match “${query}”` : "No notes on this page"}
          </strong>
          <p>
            {query
              ? "A saved note may no longer match this search."
              : "Go back to the first page to see your notes."}
          </p>
          <button
            disabled={!hydrated}
            onClick={() => {
              setQuery("");
              setPage(0);
              void refresh("", 0, sort);
            }}
          >
            Show all notes
          </button>
        </div>
      ) : null}
      <details
        className="notes-extra"
        key={`retry-${lesson}`}
        open={lesson === "mutations"}
      >
        <summary>
          Test a repeated save <ChevronRight size={13} />
        </summary>
        <p>
          Send the last add request again. The remote should return the same
          note, without adding another copy.
        </p>
        <button
          disabled={!hydrated || pending || !lastCreate.current}
          onClick={() => void create(true)}
        >
          Repeat last save
        </button>
        {!lastCreate.current && (
          <small>Add a note first to enable this test.</small>
        )}
      </details>
      <details
        className="notes-extra"
        key={`browse-${lesson}`}
        open={lesson === "races"}
      >
        <summary>
          Sorting & pages <ChevronRight size={13} />
        </summary>
        <div className="notes-browse">
          <button
            disabled={!hydrated}
            onClick={() => {
              const next = sort === "asc" ? "desc" : "asc";
              setSort(next);
              setPage(0);
              void refresh(query, 0, next);
            }}
          >
            Reverse sort
          </button>
          <span>
            {sort === "asc" ? "A → Z" : "Z → A"} · Page {page + 1}
          </span>
          <button
            disabled={!hydrated}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void refresh(query, next, sort);
            }}
          >
            Next page
          </button>
        </div>
      </details>
      <div className="notes-response" aria-live="polite">
        {pending
          ? "Sending request…"
          : lastResponse
            ? lastResponse.status === null
              ? "Last request failed · network error"
              : `Last response · HTTP ${lastResponse.status}`
            : initialData
              ? "Loaded on the server · ready before JavaScript"
              : "No private data loaded"}
      </div>
      <details className="notes-debug">
        <summary>
          Developer details <ChevronRight size={13} />
        </summary>
        <p data-testid="private-query">
          Query: {data?.query ?? ""} · Page: {data?.page ?? 0} · Sort:{" "}
          {data?.sort ?? "asc"} · Total: {data?.total ?? 0}
        </p>
        <section
          className="workspace-activity"
          aria-label="Actual HTTP activity"
        >
          <div>
            <strong>Request history</strong>
            <span>No cookies or payloads logged</span>
          </div>
          {activity.length === 0 ? (
            <p>No browser requests yet.</p>
          ) : (
            <ol>
              {activity.map((event) => (
                <li
                  key={event.id}
                  data-testid="http-response"
                  data-status={event.status ?? "network-error"}
                >
                  <div>
                    <span
                      className={
                        event.status !== null && event.status < 400
                          ? "http-status good"
                          : "http-status bad"
                      }
                    >
                      {event.status ?? "Network error"}
                    </span>
                    <strong>{event.operation}</strong>
                    <small>
                      #{event.id} · headers in {event.duration} ms
                    </small>
                  </div>
                  <code>
                    {event.method} {event.origin}
                    {event.path.replace(/(\/_serverFn\/).*/, "$1…")}
                  </code>
                  {event.operation === "Read items" &&
                    event.id < newestRead.current && (
                      <span className="http-stale">
                        Older read — the latest request keeps control of the UI.
                      </span>
                    )}
                </li>
              ))}
            </ol>
          )}
          <p className="workspace-protocol-note">
            HTTP 200 describes transport success. A serialized server-function
            error or incompatible DTO can still be rejected by the caller.
          </p>
        </section>
        <code data-testid="workspace-backend">
          {data
            ? `orders · PID ${data.pid} · release ${data.release} · auth-header ${data.receivedAuthorization} · unrelated-cookie ${data.receivedUnrelatedCookie}`
            : "No backend response"}
        </code>
      </details>
    </section>
  );
}
