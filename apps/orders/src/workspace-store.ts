import { randomUUID } from "node:crypto";
import type { DemoActor } from "@lab/session";

export interface Note {
  id: string;
  title: string;
  version: number;
}
type UserState = {
  notes: Note[];
  requests: Map<string, { title: string; note: Note }>;
};
export class WorkspaceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export class WorkspaceStore {
  private users = new Map<string, UserState>();
  private state(actor: DemoActor) {
    let state = this.users.get(actor.user);
    if (!state) {
      state = {
        notes: [
          {
            id: `${actor.user}-seed`,
            title: `${actor.user === "alice" ? "Alice" : "Bob"} private item`,
            version: 1,
          },
        ],
        requests: new Map(),
      };
      this.users.set(actor.user, state);
    }
    return state;
  }
  list(actor: DemoActor, query = "", page = 0, sort: "asc" | "desc" = "asc") {
    const notes = this.state(actor)
      .notes.filter((note) =>
        note.title.toLowerCase().includes(query.toLowerCase()),
      )
      .sort(
        (a, b) => (sort === "asc" ? 1 : -1) * a.title.localeCompare(b.title),
      );
    return {
      notes: notes.slice(page * 4, page * 4 + 4).map((note) => ({ ...note })),
      total: notes.length,
    };
  }
  create(actor: DemoActor, title: string, requestId: string) {
    if (actor.role !== "admin")
      throw new WorkspaceError(403, "This account cannot edit items.");
    const clean = title.trim();
    if (
      clean.length < 3 ||
      clean.length > 80 ||
      !/^[\w-]{8,80}$/.test(requestId)
    )
      throw new WorkspaceError(
        422,
        "Use a title of 3–80 characters and a valid request ID.",
      );
    const state = this.state(actor);
    const previous = state.requests.get(requestId);
    if (previous) {
      if (previous.title !== clean)
        throw new WorkspaceError(
          409,
          "Request ID was already used for another title.",
        );
      return { ...previous.note };
    }
    if (state.notes.length >= 200)
      throw new WorkspaceError(409, "Demo workspace is full.");
    const note = { id: randomUUID(), title: clean, version: 1 };
    state.notes.push(note);
    state.requests.set(requestId, { title: clean, note: { ...note } });
    return { ...note };
  }
  update(actor: DemoActor, id: string, title: string, version: number) {
    if (actor.role !== "admin")
      throw new WorkspaceError(403, "This account cannot edit items.");
    const note = this.state(actor).notes.find((item) => item.id === id);
    if (!note)
      throw new WorkspaceError(404, "Item not found in your workspace.");
    if (note.version !== version)
      throw new WorkspaceError(409, "Item changed. Reload before saving.");
    if (title.trim().length < 3 || title.trim().length > 80)
      throw new WorkspaceError(422, "Use a title of 3–80 characters.");
    note.title = title.trim();
    note.version++;
    return { ...note };
  }
}
export const workspaceStore = new WorkspaceStore();
