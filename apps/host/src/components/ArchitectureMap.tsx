import { useState } from "react";
import { ArrowRight, Boxes, Code2, Server, ShieldCheck } from "lucide-react";

export function ArchitectureMap() {
  const [mode, setMode] = useState<"ssr" | "browser">("ssr");
  return (
    <section
      className="architecture-card"
      aria-label="Application architecture"
    >
      <div className="architecture-heading">
        <span>ONE PAGE. FOUR APPLICATIONS.</span>
        <div aria-label="Request path">
          <button aria-pressed={mode === "ssr"} onClick={() => setMode("ssr")}>
            Initial SSR
          </button>
          <button
            aria-pressed={mode === "browser"}
            onClick={() => setMode("browser")}
          >
            Browser action
          </button>
        </div>
      </div>
      <div className="architecture-flow">
        <div className="architecture-node">
          <Code2 size={19} />
          <strong>Browser</strong>
          <small>
            {mode === "ssr" ? "Requests a page" : "Calls a remote component"}
          </small>
        </div>
        <ArrowRight size={18} />
        <div className="architecture-node host">
          <Server size={19} />
          <strong>Host · :3005</strong>
          <small>
            {mode === "ssr"
              ? "Preloads, then renders"
              : "Forwards namespaced RPC"}
          </small>
        </div>
        <ArrowRight size={18} />
        <div className="architecture-node remote">
          <ShieldCheck size={19} />
          <strong>Remote backend</strong>
          <small>
            {mode === "ssr"
              ? "Returns its own data"
              : "Checks session & permissions"}
          </small>
        </div>
      </div>
      <div className="architecture-remotes">
        <div>
          <Boxes size={15} />
          <span>
            <strong>Catalog</strong>TanStack Start · :3004
          </span>
        </div>
        <div>
          <ShieldCheck size={15} />
          <span>
            <strong>Orders</strong>TanStack Start · :3006
          </span>
        </div>
        <div>
          <Code2 size={15} />
          <span>
            <strong>Warehouse</strong>Plain React · :3007
          </span>
        </div>
      </div>
      <p data-testid="architecture-explanation">
        {mode === "ssr"
          ? "The host loads remote components and their data before rendering. The first HTML response already contains the table, orders and checklist."
          : "The remote component calls its private server function through the host. Only the allowlisted session cookie is forwarded; the remote backend makes the access decision."}
      </p>
    </section>
  );
}
