import type { loadWorkspace } from "./workspace-functions";
export type WorkspaceSnapshot = Awaited<ReturnType<typeof loadWorkspace>>;
export function parseWorkspaceSnapshot(value: unknown): WorkspaceSnapshot {
  if (
    !value ||
    typeof value !== "object" ||
    !("contractVersion" in value) ||
    value.contractVersion !== "v1" ||
    !("notes" in value) ||
    !Array.isArray(value.notes) ||
    !("actor" in value) ||
    !value.actor ||
    typeof value.actor !== "object" ||
    !("user" in value.actor) ||
    !["alice", "bob"].includes(String(value.actor.user))
  )
    throw new Error(
      "Remote contract mismatch. Reload after updating the workspace.",
    );
  if (
    value.notes.some(
      (note: unknown) =>
        !note ||
        typeof note !== "object" ||
        !("id" in note) ||
        typeof note.id !== "string" ||
        !("title" in note) ||
        typeof note.title !== "string" ||
        !("version" in note) ||
        !Number.isInteger(note.version),
    )
  )
    throw new Error("Remote contract mismatch: invalid item data.");
  return value as WorkspaceSnapshot;
}
