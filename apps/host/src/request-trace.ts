type Trace = { id: string; started: number; route: string };
const active = new WeakMap<Request, Trace>();
export function beginTrace(request: Request): Trace {
  const namespace = new URL(request.url).pathname.match(
    /^\/_federation\/(catalog|orders)\/_serverFn\//,
  )?.[1];
  const trace = {
    id: crypto.randomUUID(),
    started: performance.now(),
    route: namespace ?? "host",
  };
  active.set(request, trace);
  return trace;
}
export function traceHeaders(request?: Request): Record<string, string> {
  const trace = request && active.get(request);
  return trace ? { "x-lab-request-id": trace.id } : {};
}
export function traceResponse(response: Response, trace: Trace): Response {
  const headers = new Headers(response.headers);
  headers.set("x-lab-request-id", trace.id);
  headers.set("x-lab-route", trace.route);
  headers.append(
    "server-timing",
    `lab;dur=${Math.max(0, performance.now() - trace.started).toFixed(1)}`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
export function endTrace(request: Request) {
  active.delete(request);
}
