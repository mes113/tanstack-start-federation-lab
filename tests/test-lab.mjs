import { buildLab, startLab } from "../scripts/lab.mjs";
import { cleanup } from "../scripts/processes.mjs";
import { createFaultProxy } from "./fault-proxy.mjs";
export async function createTestLab() {
  process.env.LAB_TEST_MODE = "1";
  process.env.LAB_SESSION_SECRET ??= "rstest-local-fixture-secret";
  process.env.ORDERS_INTERNAL_ORIGIN = "http://127.0.0.1:3016";
  const proxy = await createFaultProxy();
  try {
    const command = process.env.LAB_RUNTIME === "dev" ? "dev" : "preview";
    if (command === "preview" && process.env.LAB_SKIP_BUILD !== "1")
      await buildLab();
    const control = await startLab(command);
    return {
      ...control,
      proxy,
      cleanup: async () => {
        await cleanup();
        await proxy.close();
      },
    };
  } catch (error) {
    await cleanup();
    await proxy.close();
    throw error;
  }
}
