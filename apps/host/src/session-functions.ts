import { createServerFn } from "@tanstack/react-start";
export const getDemoIdentity = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const { verifySession, sessionCookie } = await import("@lab/session");
    return verifySession(getCookie(sessionCookie));
  },
);
export const selectDemoIdentity = createServerFn({ method: "POST" })
  .validator((user: "alice" | "bob" | "logout") => {
    if (!["alice", "bob", "logout"].includes(user))
      throw new Error("Unknown demo identity");
    return user;
  })
  .handler(async ({ data }) => {
    const { setCookie, deleteCookie } =
      await import("@tanstack/react-start/server");
    const { issueSession, sessionCookie } = await import("@lab/session");
    if (data === "logout") deleteCookie(sessionCookie, { path: "/" });
    else
      setCookie(sessionCookie, issueSession(data), {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      });
    return { ok: true };
  });
