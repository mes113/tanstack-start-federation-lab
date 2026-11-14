import { useState } from "react";
import { listProducts } from "../server-functions";
import WorkspacePanel from "./WorkspacePanel";
import { loadWorkspace, type WorkspaceQuery } from "../workspace-functions";
import { parseWorkspaceSnapshot } from "../workspace-contract";
import "../styles.css";

type Snapshot = Awaited<ReturnType<typeof listProducts>>;
type Input = { fail: boolean; delayMs: number; customer: string };
export interface OrdersPanelProps {
  initialData: Snapshot | null;
  initialError?: string;
}

function OrdersPanelView({ initialData, initialError }: OrdersPanelProps) {
  const [snapshot, setSnapshot] = useState(initialData);
  const [error, setError] = useState(
    initialError ?? (initialData ? "" : "Orders backend is unavailable."),
  );
  const [pending, setPending] = useState(false);
  const [customer, setCustomer] = useState("");
  async function load(fail = false, delayMs = 50) {
    setPending(true);
    setError("");
    try {
      setSnapshot(await listProducts({ data: { fail, delayMs, customer } }));
    } catch {
      setError(
        "Orders could not be loaded. The rest of your workspace is still available.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section
      className="lab-card"
      data-testid="orders-panel"
      aria-busy={pending}
    >
      <header>
        <div>
          <span className="lab-kicker">TANSTACK REMOTE · ORDERS</span>
          <h2>Recent orders</h2>
        </div>
        <span className="lab-tag">:3006</span>
      </header>
      <p className="lab-description">
        An independent backend, loaded on the host during SSR.
      </p>
      <div className="lab-actions">
        <input
          aria-label="Find customer"
          placeholder="Find a customer…"
          value={customer}
          onChange={(e) => setCustomer(e.target.value)}
        />
        <button disabled={pending} onClick={() => void load()}>
          Refresh orders
        </button>
      </div>
      {error ? (
        <div className="lab-error" role="alert" data-testid="orders-error">
          <strong>Orders temporarily unavailable</strong>
          <p>{error}</p>
          <button disabled={pending} onClick={() => void load()}>
            Retry orders
          </button>
        </div>
      ) : (
        <div className="orders-list">
          {snapshot?.rows.length ? (
            snapshot.rows.map((row) => (
              <div className="order-row" key={row.id} data-testid="order-row">
                <div>
                  <strong>{row.id}</strong>
                  <span>{row.customer}</span>
                </div>
                <span>{row.status}</span>
                <strong>${row.total}</strong>
              </div>
            ))
          ) : (
            <p>No matching orders.</p>
          )}
        </div>
      )}
      <details className="lab-diagnostics">
        <summary>Backend & fault checks</summary>
        <code data-testid="orders-server">
          {snapshot
            ? `orders · PID ${snapshot.server.pid} · ${snapshot.server.time}`
            : "No backend response"}
        </code>
        <div className="lab-actions">
          <button disabled={pending} onClick={() => void load(true)}>
            Simulate orders error
          </button>
          <button disabled={pending} onClick={() => void load(false, 2200)}>
            Simulate orders timeout
          </button>
        </div>
      </details>
    </section>
  );
}

const OrdersPanel = Object.assign(OrdersPanelView, {
  Workspace: WorkspacePanel,
  preloadWorkspace: async (query: WorkspaceQuery) =>
    parseWorkspaceSnapshot(await loadWorkspace({ data: query })),
  preload: (input: Partial<Input> = {}) =>
    listProducts({
      data: { fail: false, delayMs: 50, customer: "", ...input },
    }),
});
export default OrdersPanel;
