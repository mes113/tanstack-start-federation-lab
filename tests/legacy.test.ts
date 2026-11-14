import { afterAll, beforeAll, test } from "@rstest/playwright";
import { createTestLab } from "./test-lab.mjs";
import { verify } from "./scenario.mjs";
import { verifyMulti } from "./multi-remote.mjs";
let lab: Awaited<ReturnType<typeof createTestLab>>;
beforeAll(async () => {
  lab = await createTestLab();
});
afterAll(async () => {
  await lab?.cleanup();
});
test("original catalog: SSR, table actions, CSV and backend recovery", async () => {
  await verify(lab);
});
test("multi-remote: preserve all eleven SSR and failure groups", async () => {
  await verifyMulti(lab);
});
