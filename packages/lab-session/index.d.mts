export type DemoUser = "alice" | "bob";
export interface DemoActor {
  user: DemoUser;
  role: "admin" | "viewer";
  expires: number;
}
export declare function issueSession(user: DemoUser, now?: number): string;
export declare function verifySession(
  token: string | undefined,
  now?: number,
): DemoActor | null;
export { sessionCookie, forwardSessionCookie } from "./cookie.mjs";
