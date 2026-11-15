import { createServerFn } from "@tanstack/react-start";

export interface WorkspaceQuery {
  query: string;
  delayMs: number;
  page: number;
  sort: "asc" | "desc";
}
export const loadWorkspace = createServerFn({ method: "POST" })
  .validator((data: WorkspaceQuery) => {
    if (
      !data ||
      typeof data.query !== "string" ||
      data.query.length > 80 ||
      !Number.isInteger(data.delayMs) ||
      data.delayMs < 0 ||
      data.delayMs > 900 ||
      !Number.isInteger(data.page) ||
      data.page < 0 ||
      data.page > 50 ||
      !["asc", "desc"].includes(data.sort)
    )
      throw new Error("Invalid workspace query");
    return data;
  })
  .handler(async ({ data }) => {
    const { getCookie, getRequestHeader, setResponseStatus } =
      await import("@tanstack/react-start/server");
    const { verifySession, sessionCookie } = await import("@lab/session");
    const started = performance.now();
    const actor = verifySession(getCookie(sessionCookie));
    if (!actor) {
      setResponseStatus(401);
      throw new Error("Sign in to view your workspace.");
    }
    await new Promise((resolve) => setTimeout(resolve, data.delayMs));
    const { workspaceStore } = await import("./workspace-store");
    return {
      ...workspaceStore.list(actor, data.query, data.page, data.sort),
      actor,
      query: data.query,
      page: data.page,
      sort: data.sort,
      app: "orders" as const,
      viaHost: !!getRequestHeader("x-lab-request-id"),
      durationMs: Math.round(performance.now() - started),
      requestId: getRequestHeader("x-lab-request-id") ?? crypto.randomUUID(),
      pid: process.pid,
      receivedAuthorization: !!getRequestHeader("authorization"),
      receivedUnrelatedCookie: (getRequestHeader("cookie") ?? "").includes(
        "unrelated=",
      ),
      contractVersion: process.env.LAB_CONTRACT_VERSION ?? "v1",
      release: process.env.LAB_RELEASE ?? "v1",
    };
  });

export const createWorkspaceItem = createServerFn({ method: "POST" })
  .validator((data: { title: string; requestId: string }) => {
    if (
      !data ||
      typeof data.title !== "string" ||
      typeof data.requestId !== "string"
    )
      throw new Error("Invalid mutation input");
    return data;
  })
  .handler(async ({ data }) => {
    const { getCookie, setResponseStatus } =
      await import("@tanstack/react-start/server");
    const { verifySession, sessionCookie } = await import("@lab/session");
    const actor = verifySession(getCookie(sessionCookie));
    if (!actor) {
      setResponseStatus(401);
      throw new Error("Sign in first.");
    }
    const { workspaceStore, WorkspaceError } =
      await import("./workspace-store");
    try {
      return {
        ok: true as const,
        note: workspaceStore.create(actor, data.title, data.requestId),
      };
    } catch (error) {
      if (!(error instanceof WorkspaceError)) throw error;
      setResponseStatus(error.status);
      return {
        ok: false as const,
        status: error.status,
        message: error.message,
      };
    }
  });

export const updateWorkspaceItem = createServerFn({ method: "POST" })
  .validator((data: { id: string; title: string; version: number }) => {
    if (
      !data ||
      typeof data.id !== "string" ||
      typeof data.title !== "string" ||
      !Number.isInteger(data.version)
    )
      throw new Error("Invalid update input");
    return data;
  })
  .handler(async ({ data }) => {
    const { getCookie, setResponseStatus } =
      await import("@tanstack/react-start/server");
    const { verifySession, sessionCookie } = await import("@lab/session");
    const actor = verifySession(getCookie(sessionCookie));
    if (!actor) {
      setResponseStatus(401);
      throw new Error("Sign in first.");
    }
    const { workspaceStore, WorkspaceError } =
      await import("./workspace-store");
    try {
      return {
        ok: true as const,
        note: workspaceStore.update(actor, data.id, data.title, data.version),
      };
    } catch (error) {
      if (!(error instanceof WorkspaceError)) throw error;
      setResponseStatus(error.status);
      return {
        ok: false as const,
        status: error.status,
        message: error.message,
      };
    }
  });
