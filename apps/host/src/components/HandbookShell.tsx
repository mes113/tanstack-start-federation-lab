import { Button } from "@lab/ui/button";
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Boxes, Scan, ArrowUpRight, Menu, X } from "lucide-react";
const Topics = [
  ["/guide", "Overview", "A map of the reference app"],
  ["/getting-started", "Getting started", "Run it and connect a remote"],
  ["/", "Data & SSR", "A remote-owned product catalog"],
  ["/scenarios", "Sessions & writes", "Private notes across boundaries"],
  ["/lab", "Errors & recovery", "Compose, break and recover"],
  ["/types", "Type safety", "Generated contracts and checks"],
] as const;
const BoundaryContext = createContext(false);
export function BoundaryFrame({
  owner,
  children,
}: {
  owner: "Host" | "Catalog" | "Orders" | "Warehouse";
  children: ReactNode;
}) {
  const shown = useContext(BoundaryContext);
  return (
    <div
      className="boundary-frame"
      data-owner={owner}
      data-outlined={shown || undefined}
    >
      <span className="boundary-label" hidden={!shown}>
        {owner === "Host"
          ? "Host · shell & route data"
          : `${owner} · remote-owned UI`}
      </span>
      {children}
    </div>
  );
}
export function HandbookShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [boundaries, setBoundaries] = useState(false);
  const [menu, setMenu] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  useEffect(() => setMenu(false), [pathname]);
  const active = Topics.find(([path]) => path === pathname);
  const participants =
    pathname === "/"
      ? ["Host", "Catalog"]
      : pathname === "/scenarios"
        ? ["Host", "Orders"]
        : pathname === "/lab"
          ? ["Host", "Catalog", "Orders", "Warehouse"]
          : [];
  return (
    <BoundaryContext.Provider value={boundaries}>
      <a className="demo-skip" href="#demo-content">
        Skip to content
      </a>
      <header className="handbook-header">
        <Link to="/guide" className="demo-brand">
          <span>
            <Boxes size={20} />
          </span>
          <strong>Federation Lab</strong>
          <small>the interactive handbook</small>
        </Link>
        <span className="handbook-breadcrumb">
          Handbook <span>/</span> {active?.[1] ?? "Example"}
        </span>
        <div className="handbook-actions">
          <Button
            variant="outline"
            disabled={!ready}
            aria-pressed={boundaries}
            onClick={() => setBoundaries(!boundaries)}
          >
            <Scan size={15} />
            {boundaries ? "Hide app boundaries" : "Show app boundaries"}
          </Button>
          <a
            href="https://github.com/mes113/tanstack-start-federation-lab"
            target="_blank"
            rel="noreferrer"
          >
            GitHub <ArrowUpRight size={13} />
          </a>
          <Button
            variant="outline"
            className="handbook-menu-button"
            aria-label={menu ? "Close topics" : "Open topics"}
            aria-expanded={menu}
            aria-controls="handbook-sidebar"
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>
      </header>
      <div className="handbook-layout">
        <aside
          className="handbook-sidebar"
          id="handbook-sidebar"
          data-open={menu}
        >
          <span className="handbook-section-label">THE HANDBOOK</span>
          <nav aria-label="Handbook topics">
            {Topics.map(([path, label, description], index) => (
              <Link
                key={path}
                onClick={() => setMenu(false)}
                to={path}
                search={
                  path === "/lab"
                    ? { fault: "none" }
                    : path === "/scenarios"
                      ? { query: "", page: 0, sort: "asc" }
                      : {}
                }
                aria-current={pathname === path ? "page" : undefined}
              >
                <small>{String(index).padStart(2, "0")}</small>
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
              </Link>
            ))}
          </nav>
          <section className="handbook-system">
            <span className="handbook-section-label">THE APPLICATIONS</span>
            <p>
              {participants.length
                ? "Used by this example"
                : "Architecture reference"}
            </p>
            {[
              ["Host", "TanStack Start", 3005],
              ["Catalog", "TanStack Start", 3004],
              ["Orders", "TanStack Start", 3006],
              ["Warehouse", "Plain React", 3007],
            ].map(([name, stack]) => (
              <div
                key={name}
                data-participates={participants.includes(String(name))}
              >
                <i />
                <span>
                  <strong>{name}</strong>
                  <small>{stack}</small>
                </span>
              </div>
            ))}
            <small>Connections describe ownership, not service health.</small>
            <details className="handbook-system-details">
              <summary>Runtime details</summary>
              <p>
                Host :3005
                <br />
                Catalog :3004
                <br />
                Orders :3006
                <br />
                Warehouse :3007
              </p>
            </details>
          </section>
          <p className="handbook-sidebar-footer">
            One shell. Three remotes.
            <br />
            Component-only federation exposes.
          </p>
        </aside>
        <div className="handbook-content">
          {boundaries && (
            <div className="boundary-legend" role="status">
              <Scan size={15} />
              <span>
                Ownership view is on. Outlines label the host and remote UI.
                They do not measure rendering or network health.
              </span>
            </div>
          )}
          {children}
        </div>
      </div>
    </BoundaryContext.Provider>
  );
}
