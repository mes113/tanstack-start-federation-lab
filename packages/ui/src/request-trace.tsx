export interface RequestObservation {
  source: "ssr" | "browser";
  requestId?: string;
  status?: number | null;
  durationMs?: number;
  backendMs?: number;
  viaHost?: boolean;
}
export function RequestTrace({
  app,
  observation,
}: {
  app: string;
  observation: RequestObservation;
}) {
  return (
    <details className="request-trace" data-testid={`trace-${app}`}>
      <summary>
        {observation.source === "ssr" ? "SSR preload" : "Browser request"} ·{" "}
        {app} backend
        {observation.status != null ? ` · HTTP ${observation.status}` : ""}
      </summary>
      <ol aria-label="Observed request path">
        <li>
          {observation.source === "ssr" ? "Page request" : "Remote component"}
        </li>
        <li>
          {observation.viaHost === false ? "Standalone remote" : "Host shell"}
        </li>
        <li>{app} backend</li>
      </ol>
      <dl>
        <div>
          <dt>Request ID</dt>
          <dd data-testid={`trace-id-${app}`}>
            {observation.requestId ?? "No host correlation ID received"}
          </dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>
            {observation.source === "ssr" && observation.backendMs != null
              ? `${observation.backendMs} ms (backend handler)`
              : observation.durationMs == null
                ? "Not measured in this preload snapshot"
                : `${observation.durationMs} ms (browser round trip)`}
          </dd>
        </div>
      </dl>
      <small>
        The route describes configured ownership; failures may not reach the
        backend. HTTP status describes transport. Application errors can also
        arrive in HTTP 200 responses. IDs contain no cookies or request payload.
      </small>
    </details>
  );
}
