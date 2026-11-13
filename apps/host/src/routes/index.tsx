import { lazyRemote } from "@module-federation/tanstack/runtime";
import { createFileRoute } from "@tanstack/react-router";
import { Component, Suspense, type ReactNode } from "react";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Package,
  PanelLeft,
  Sparkles,
  Store,
  Layers3,
  ArrowUpRight,
} from "lucide-react";

const ServerPanel = lazyRemote(() => import("catalog/ServerPanel"));

export const Route = createFileRoute("/")({
  loader: async () => {
    const remote = await import("catalog/ServerPanel").catch(() => null);
    const initialData = remote
      ? await remote.default.preload().catch(() => null)
      : null;
    return { initialData };
  },
  component: Home,
});

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">Remote component unavailable. Start remote and reload.</p>
    ) : (
      this.props.children
    );
  }
}

function Home() {
  const { initialData } = Route.useLoaderData();
  return (
    <div className="app-shell">
      <aside className="shell-sidebar">
        <a href="/" className="brand">
          <div className="brand-symbol">
            <Layers3 size={22} />
          </div>
          folio<span>workspace</span>
        </a>
        <div className="workspace-switch">
          <div className="workspace-avatar">
            <Store size={18} />
          </div>
          <div>
            <strong>Studio Store</strong>
            <span>Commerce workspace</span>
          </div>
          <ChevronDown size={15} />
        </div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <a href="/" className="nav-link active" aria-current="page">
            <Package size={18} />
            <span>Products</span>
            <span className="nav-count">{initialData?.counts.All ?? "–"}</span>
          </a>
        </nav>
        <div className="sidebar-note">
          <div className="sidebar-note-icon">
            <Boxes size={22} />
          </div>
          <strong>A place for every product.</strong>
          <p>
            A clearer view of your collection, from the first idea to the final
            sale.
          </p>
          <div>
            <span className="small-dot" />
            Studio collection
          </div>
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-plan">
            <Sparkles size={15} />
            <span>Studio workspace</span>
            <span className="plan-badge">PRO</span>
          </div>
          <div className="account">
            <div className="account-avatar">AS</div>
            <div>
              <strong>Alex Smith</strong>
              <span>Store owner</span>
            </div>
          </div>
        </div>
      </aside>
      <div className="shell-body">
        <header className="shell-header">
          <div className="breadcrumb">
            <PanelLeft size={17} />
            <span className="breadcrumb-divider" />
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>Products</strong>
          </div>
          <div className="header-right">
            <span className="workspace-visibility">
              <span />
              Private workspace
            </span>
            <div className="header-avatar">AS</div>
          </div>
        </header>
        <main className="shell-content">
          <Boundary>
            <Suspense
              fallback={
                <div className="route-loading">Loading your catalog…</div>
              }
            >
              <ServerPanel title="Products" initialData={initialData} />
            </Suspense>
          </Boundary>
          <footer className="shell-footer">
            <span>© 2026 Folio Studio</span>
            <a href="http://127.0.0.1:3004" target="_blank" rel="noreferrer">
              Open standalone catalog <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      </div>
    </div>
  );
}
