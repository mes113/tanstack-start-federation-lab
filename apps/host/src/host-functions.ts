import { createServerFn } from "@tanstack/react-start";
export const getHostSummary = createServerFn({ method: "GET" }).handler(
  async () => ({
    app: "host" as const,
    pid: process.pid,
    workspace: "Studio Store",
    message: "Host server function answered",
    time: new Date().toISOString(),
  }),
);
