import { createHmac, timingSafeEqual } from "node:crypto";
export { sessionCookie, forwardSessionCookie } from "./cookie.mjs";
// A local identity fixture, not an authentication provider.
const key = () =>
  process.env.LAB_SESSION_SECRET ?? "local-federation-demo-only";
/** @param {string} payload */
function signature(payload) {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}
/** @param {"alice" | "bob"} user */
export function issueSession(user, now = Date.now()) {
  const actor = {
    user,
    role: user === "alice" ? "admin" : "viewer",
    expires: now + 600_000,
  };
  const payload = Buffer.from(JSON.stringify(actor)).toString("base64url");
  return `${payload}.${signature(payload)}`;
}
/** @param {string | undefined} token
 * @returns {import('./index.mjs').DemoActor | null}
 */
export function verifySession(token, now = Date.now()) {
  if (!token || token.length > 1024) return null;
  try {
    const [payload, supplied, extra] = token.split(".");
    if (!payload || !supplied || extra) return null;
    const expected = Buffer.from(signature(payload));
    const actual = Buffer.from(supplied);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const actor = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    if (
      !["alice", "bob"].includes(actor.user) ||
      actor.role !== (actor.user === "alice" ? "admin" : "viewer") ||
      !Number.isFinite(actor.expires) ||
      actor.expires <= now
    )
      return null;
    return actor;
  } catch {
    return null;
  }
}
