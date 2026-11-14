import { describe, expect, test } from "@rstest/core";
import {
  issueSession,
  verifySession,
  forwardSessionCookie,
  type DemoActor,
} from "@lab/session";
import { WorkspaceStore } from "../apps/orders/src/workspace-store";
import { parseWorkspaceSnapshot } from "../apps/orders/src/workspace-contract";
const alice: DemoActor = {
  user: "alice",
  role: "admin",
  expires: 9999999999999,
};
const bob: DemoActor = { user: "bob", role: "viewer", expires: 9999999999999 };

describe("signed local session fixture", () => {
  test("verifies identity and server-owned role", () => {
    expect(verifySession(issueSession("alice", 100), 101)).toEqual({
      user: "alice",
      role: "admin",
      expires: 600100,
    });
  });
  test("rejects expired tokens", () => {
    expect(verifySession(issueSession("alice", 100), 600100)).toBeNull();
  });
  test("rejects changed signatures", () => {
    expect(verifySession(issueSession("alice", 100) + "x", 101)).toBeNull();
  });
  test("rejects forged roles even with a copied payload", () => {
    const token = issueSession("bob", 100);
    const forged = `${Buffer.from(JSON.stringify({ ...bob, role: "admin" })).toString("base64url")}.${token.split(".")[1]}`;
    expect(verifySession(forged, 101)).toBeNull();
  });
  test.each([
    ["missing", undefined],
    ["empty", ""],
    ["separator", "."],
    ["extra segment", "a.b.c"],
    ["oversized", "x".repeat(1025)],
  ])("rejects malformed token (%s)", (_label, token) => {
    expect(verifySession(token)).toBeNull();
  });
  test("forwards only the allowlisted session cookie", () => {
    expect(
      forwardSessionCookie("unrelated=secret; lab_session=signed; other=no"),
    ).toBe("lab_session=signed");
  });
});
describe("remote-owned mutations", () => {
  test("isolates each user's private state", () => {
    const store = new WorkspaceStore();
    expect(store.list(alice).notes[0]?.title).toBe("Alice private item");
    expect(store.list(bob).notes[0]?.title).toBe("Bob private item");
  });
  test("rejects invalid titles without writing", () => {
    const store = new WorkspaceStore();
    expect(() => store.create(alice, " ", "request-001")).toThrow("3–80");
    expect(store.list(alice).total).toBe(1);
  });
  test("replaying a mutation is idempotent", () => {
    const store = new WorkspaceStore();
    const first = store.create(alice, "New product", "request-001");
    expect(store.create(alice, "New product", "request-001")).toEqual(first);
    expect(store.list(alice).total).toBe(2);
  });
  test("rejects a reused key with different data", () => {
    const store = new WorkspaceStore();
    store.create(alice, "New product", "request-001");
    expect(() => store.create(alice, "Other product", "request-001")).toThrow(
      "already used",
    );
  });
  test("viewer cannot create or update", () => {
    const store = new WorkspaceStore();
    expect(() => store.create(bob, "No write", "request-001")).toThrow(
      "cannot edit",
    );
    expect(() => store.update(bob, "bob-seed", "No write", 1)).toThrow(
      "cannot edit",
    );
  });
  test("owner cannot update another user's item", () => {
    const store = new WorkspaceStore();
    expect(() => store.update(alice, "bob-seed", "Foreign write", 1)).toThrow(
      "not found",
    );
  });
  test("optimistic locking rejects stale edits", () => {
    const store = new WorkspaceStore();
    expect(store.update(alice, "alice-seed", "Updated title", 1).version).toBe(
      2,
    );
    expect(() => store.update(alice, "alice-seed", "Stale title", 1)).toThrow(
      "Item changed",
    );
  });
  test("concurrent retries create one record", async () => {
    const store = new WorkspaceStore();
    const results = await Promise.all(
      Array.from({ length: 20 }, async () =>
        store.create(alice, "One record", "request-001"),
      ),
    );
    expect(new Set(results.map((note) => note.id)).size).toBe(1);
    expect(store.list(alice).total).toBe(2);
  });
  test("returned records cannot mutate backend state", () => {
    const store = new WorkspaceStore();
    const note = store.list(alice).notes[0]!;
    note.title = "Mutated client object";
    expect(store.list(alice).notes[0]?.title).toBe("Alice private item");
  });
  test("sorts, filters and paginates before returning rows", () => {
    const store = new WorkspaceStore();
    for (let i = 0; i < 7; i++)
      store.create(alice, `Item ${i}`, `request-00${i}`);
    expect(
      store.list(alice, "Item", 1, "desc").notes.map((note) => note.title),
    ).toEqual(["Item 2", "Item 1", "Item 0", "Alice private item"]);
  });
});
describe("runtime contract guard", () => {
  test.each([
    null,
    {},
    { contractVersion: "v2", notes: [], actor: { user: "alice" } },
    { contractVersion: "v1", notes: [{ title: 7 }], actor: { user: "alice" } },
  ])("rejects incompatible data %#", (value) => {
    expect(() => parseWorkspaceSnapshot(value)).toThrow("contract mismatch");
  });
});
