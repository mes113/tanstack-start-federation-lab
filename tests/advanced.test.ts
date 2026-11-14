import {
  afterAll,
  beforeAll,
  expect,
  test,
  type Page,
} from "@rstest/playwright";
import { readFile, writeFile, rename, mkdir, readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { issueSession } from "@lab/session";
import { createTestLab } from "./test-lab.mjs";

const base = "http://127.0.0.1:3005";
const ordersRpc = "/_federation/orders/_serverFn/";
let lab: Awaited<ReturnType<typeof createTestLab>>;
beforeAll(async () => {
  lab = await createTestLab();
  await mkdir("test-results", { recursive: true });
});
afterAll(async () => {
  await lab?.cleanup();
});

async function login(page: Page, user: "alice" | "bob") {
  await page.goto(`${base}/scenarios`);
  await page
    .getByRole("button", {
      name: user === "alice" ? "Use Alice (admin)" : "Use Bob (viewer)",
      exact: true,
    })
    .click();
  await expect(page.getByTestId("session-user")).toHaveText(user);
  await expect(page.getByTestId("workspace-owner")).toHaveText(
    `${user}'s workspace`,
  );
  await expect(page.getByTestId("private-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function action(page: Page, run: () => Promise<unknown>, status = 200) {
  const waiting = page.waitForResponse((response) =>
    response.url().includes(ordersRpc),
  );
  await run();
  const response = await waiting;
  expect(response.status()).toBe(status);
  await expect(page.getByTestId("private-workspace")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  return response;
}
async function command(args: string[], cwd = process.cwd()) {
  const child = spawn(process.execPath, args, {
    cwd,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const [code] = await once(child, "exit");
  return { code, output };
}
async function ordersBackendCode() {
  const directory = resolve("apps/orders/dist/server");
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".js"))
    .sort();
  return (
    await Promise.all(
      files.map((file) => readFile(resolve(directory, file), "utf8")),
    )
  ).join("\n");
}

test("sessions: signed cookies, 401/403 and SSR isolation across two users", async ({
  browser,
  page,
}) => {
  const guest = await action(
    page,
    async () => {
      await page.goto(`${base}/scenarios`);
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
    },
    401,
  );
  expect(guest.url()).toContain(ordersRpc);
  await expect(page.getByTestId("private-error")).toBeVisible();
  await login(page, "alice");
  const cookie = (await page.context().cookies()).find(
    (item) => item.name === "lab_session",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    "lab_session",
  );
  await page
    .context()
    .addCookies([
      { name: "unrelated", value: "must-not-reach-remote", url: base },
    ]);
  await page
    .context()
    .setExtraHTTPHeaders({ authorization: "Bearer do-not-forward" });
  await page.reload();
  await expect(page.getByTestId("workspace-backend")).toContainText(
    "auth-header false · unrelated-cookie false",
  );
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  try {
    await login(bob, "bob");
    const [aliceHtml, bobHtml] = await Promise.all([
      page
        .context()
        .request.get(`${base}/scenarios`)
        .then((r) => r.text()),
      bobContext.request.get(`${base}/scenarios`).then((r) => r.text()),
    ]);
    expect(aliceHtml).toContain("Alice private item");
    expect(aliceHtml).not.toContain("Bob private item");
    expect(bobHtml).toContain("Bob private item");
    expect(bobHtml).not.toContain("Alice private item");
    await bob
      .getByRole("textbox", { name: "New note", exact: true })
      .fill("Unauthorized write");
    await action(
      bob,
      () => bob.getByRole("button", { name: "Add note", exact: true }).click(),
      403,
    );
    await expect(bob.getByTestId("private-error")).toContainText("cannot edit");
    const tampered = await browser.newContext();
    try {
      await tampered.addCookies([
        { name: "lab_session", value: cookie.value + "bad", url: base },
      ]);
      const response = await tampered.request.get(`${base}/scenarios`);
      expect(await response.text()).not.toContain("Alice private item");
    } finally {
      await tampered.close();
    }
    await page.screenshot({
      path: "test-results/private-session.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Use Bob (viewer)", exact: true })
      .click();
    await expect(page.getByTestId("workspace-owner")).toHaveText(
      "bob's workspace",
    );
    await expect(page.getByTestId("private-item")).not.toContainText(
      "Alice private item",
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByTestId("session-user")).toHaveText("guest");
    await expect(page.getByTestId("private-item")).toHaveCount(0);
  } finally {
    await bobContext.close();
  }
});

test("mutations: validation, idempotent double submit, persistence and stale edit conflict", async ({
  page,
}) => {
  await login(page, "alice");
  await page.getByRole("textbox", { name: "New note", exact: true }).fill(" ");
  await action(
    page,
    () => page.getByRole("button", { name: "Add note", exact: true }).click(),
    422,
  );
  await expect(page.getByTestId("private-error")).toContainText("3–80");
  const title = `Mutation ${randomUUID().slice(0, 8)}`;
  await action(page, () =>
    page
      .getByRole("textbox", { name: "Search notes", exact: true })
      .fill(title),
  );
  await page
    .getByRole("textbox", { name: "New note", exact: true })
    .fill(title);
  await action(page, () =>
    page
      .getByRole("button", { name: "Add note", exact: true })
      .evaluate((button: HTMLButtonElement) => {
        button.click();
        button.click();
      }),
  );
  await expect(page.getByTestId("private-item")).toHaveCount(1);
  const saved = await page.getByTestId("mutation-result").textContent();
  await page.getByText("Test a repeated save", { exact: true }).click();
  await action(page, () =>
    page.getByRole("button", { name: "Repeat last save", exact: true }).click(),
  );
  await expect(page.getByTestId("private-item")).toHaveCount(1);
  expect(await page.getByTestId("mutation-result").textContent()).toBe(saved);
  await page.goto(`${base}/scenarios?query=${encodeURIComponent(title)}`);
  await expect(page.getByTestId("private-item")).toHaveCount(1);
  const stale = await page.context().newPage();
  try {
    await stale.goto(page.url());
    await page.getByText("Edit this note", { exact: true }).click();
    await stale.getByText("Edit this note", { exact: true }).click();
    await page
      .getByRole("textbox", { name: "Edit note title", exact: true })
      .fill(`${title} updated`);
    await action(page, () =>
      page.getByRole("button", { name: "Save changes", exact: true }).click(),
    );
    await expect(page.getByTestId("private-item")).toContainText("updated");
    await stale
      .getByRole("textbox", { name: "Edit note title", exact: true })
      .fill(`${title} stale`);
    await action(
      stale,
      () =>
        stale
          .getByRole("button", { name: "Save changes", exact: true })
          .click(),
      409,
    );
    await expect(stale.getByTestId("private-error")).toContainText(
      "Item changed",
    );
  } finally {
    await stale.close();
  }
});

test("races: old search, page and sorting responses cannot overwrite newer state", async ({
  page,
}) => {
  await login(page, "alice");
  const firstRequest = page.waitForRequest((request) =>
    request.url().includes(ordersRpc),
  );
  await page
    .getByRole("textbox", { name: "Search notes", exact: true })
    .fill("a");
  const first = await firstRequest;
  const delayed = page.waitForResponse(
    (response) => response.request() === first,
  );
  await action(page, () =>
    page
      .getByRole("textbox", { name: "Search notes", exact: true })
      .fill("Alice"),
  );
  await expect(page.getByTestId("private-query")).toContainText("Query: Alice");
  await delayed;
  await expect(page.getByTestId("private-query")).toContainText("Query: Alice");
  await page.getByText("Sorting & pages", { exact: true }).click();
  const again = page.waitForRequest((request) =>
    request.url().includes(ordersRpc),
  );
  await page
    .getByRole("textbox", { name: "Search notes", exact: true })
    .fill("a");
  const old = await again;
  const stale = page.waitForResponse((response) => response.request() === old);
  await action(page, () =>
    page.getByRole("button", { name: "Reverse sort", exact: true }).click(),
  );
  await action(page, () =>
    page.getByRole("button", { name: "Next page", exact: true }).click(),
  );
  await stale;
  await expect(page.getByTestId("private-query")).toContainText(
    "Page: 1 · Sort: desc",
  );
});

test("navigation: client links, history, deep-link SSR and remounts preserve request boundaries", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await login(page, "alice");
  const marker = await page.evaluate(() => {
    const marker = crypto.randomUUID();
    document.documentElement.dataset.navigationMarker = marker;
    return marker;
  });
  await page.getByRole("link", { name: "Saved search", exact: true }).click();
  await expect(page).toHaveURL(/query=private/);
  await expect(page.getByTestId("private-query")).toContainText(
    "Query: private",
  );
  expect(
    await page.locator("html").getAttribute("data-navigation-marker"),
  ).toBe(marker);
  await page
    .getByRole("link", { name: "Descending view", exact: true })
    .click();
  await expect(page.getByTestId("private-query")).toContainText("Sort: desc");
  await page.goBack();
  await expect(page.getByTestId("private-query")).toContainText(
    "Query: private",
  );
  await page.goForward();
  await expect(page.getByTestId("private-query")).toContainText("Sort: desc");
  await page
    .getByRole("link", { name: "← SSR workspace", exact: true })
    .click();
  await expect(page.getByTestId("order-row")).toHaveCount(3);
  expect(
    await page.locator("html").getAttribute("data-navigation-marker"),
  ).toBe(marker);
  await page.goBack();
  await expect(page.getByTestId("workspace-owner")).toHaveText(
    "alice's workspace",
  );
  const noJs = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  });
  try {
    const deep = await noJs.newPage();
    await deep.goto(`${base}/scenarios?query=Alice&page=0&sort=desc`);
    await expect(deep.getByTestId("private-item")).toContainText(
      "Alice private item",
    );
    await expect(deep.getByTestId("private-query")).toContainText("Sort: desc");
  } finally {
    await noJs.close();
  }
  expect(errors).toEqual([]);
});

test("contracts: generated declarations reject breaking props and runtime DTO changes fail visibly", async ({
  page,
}) => {
  const declaration = resolve(
    "apps/host/@mf-types/orders/compiled-types/src/components/OrdersPanel.d.ts",
  );
  const original = await readFile(declaration, "utf8");
  const changed = original.replace(
    "export interface OrdersPanelProps {",
    "export interface OrdersPanelProps { requiredFromFuture: string;",
  );
  expect(changed).not.toBe(original);
  try {
    await writeFile(declaration, changed);
    const result = await command(
      [resolve("node_modules/typescript/bin/tsc"), "--noEmit"],
      resolve("apps/host"),
    );
    expect(result.code).not.toBe(0);
    expect(result.output).toContain("requiredFromFuture");
  } finally {
    await writeFile(declaration, original);
  }
  const restored = await command(
    [resolve("node_modules/typescript/bin/tsc"), "--noEmit"],
    resolve("apps/host"),
  );
  expect(restored.code).toBe(0);
  await login(page, "alice");
  await lab.stopRemote("orders");
  try {
    await lab.restartRemote("orders", { LAB_CONTRACT_VERSION: "v2" });
    await action(page, () =>
      page.getByRole("button", { name: "Refresh", exact: true }).click(),
    );
    await expect(page.getByTestId("private-error")).toContainText(
      "Remote contract mismatch",
    );
  } finally {
    await lab.stopRemote("orders");
    await lab.restartRemote("orders");
  }
  await action(page, () =>
    page.getByRole("button", { name: "Refresh", exact: true }).click(),
  );
  await expect(page.getByTestId("private-error")).toHaveCount(0);
});

test("partial failures: missing chunks/CSS/SSR entry and interrupted backend streams", async ({
  browser,
  page,
}) => {
  await login(page, "alice");
  for (const mode of ["disconnect", "slow-headers", "truncated-body"]) {
    lab.proxy.setMode(mode);
    try {
      if (mode === "truncated-body") {
        await page
          .getByRole("button", { name: "Refresh", exact: true })
          .click();
      } else
        await action(
          page,
          () =>
            page
              .getByRole("button", {
                name: "Refresh",
                exact: true,
              })
              .click(),
          502,
        );
      await expect(page.getByTestId("private-error")).toBeVisible();
    } finally {
      lab.proxy.setMode("normal");
    }
    await action(page, () =>
      page.getByRole("button", { name: "Refresh", exact: true }).click(),
    );
    await expect(page.getByTestId("private-error")).toHaveCount(0);
  }
  const chunks = await browser.newContext();
  try {
    await chunks.route("http://127.0.0.1:3007/**", (route) =>
      /\/async\/.*\.js/.test(route.request().url())
        ? route.fulfill({ status: 404, body: "Intentional missing chunk" })
        : route.continue(),
    );
    const broken = await chunks.newPage();
    await broken.goto(`${base}/lab`);
    await expect(broken.getByTestId("error-warehouse")).toBeVisible({
      timeout: 20_000,
    });
    await expect(broken.getByTestId("order-row")).toHaveCount(3);
    await broken.screenshot({
      path: "test-results/missing-react-chunk.png",
      fullPage: true,
    });
  } finally {
    await chunks.close();
  }
  const css = await browser.newContext({ javaScriptEnabled: false });
  try {
    await css.route("http://127.0.0.1:3007/**/*.css", (route) =>
      route.fulfill({ status: 404, body: "" }),
    );
    const unstyled = await css.newPage();
    await unstyled.goto(`${base}/lab`);
    await expect(unstyled.getByTestId("warehouse-panel")).toBeVisible();
    expect(
      await unstyled
        .getByTestId("warehouse-panel")
        .evaluate((element) => getComputedStyle(element).paddingTop),
    ).not.toBe("25px");
    await expect(unstyled.getByTestId("product-row")).toHaveCount(8);
  } finally {
    await css.close();
  }
  if (lab.command === "preview") {
    const entry = resolve("apps/react-remote/dist/remoteEntry.ssr.cjs");
    const backup = entry + ".test-backup";
    await rename(entry, backup);
    try {
      expect(
        (await fetch("http://127.0.0.1:3007/mf-manifest.json")).status,
      ).toBe(200);
      await lab.restartHost();
      const offline = await browser.newContext({ javaScriptEnabled: false });
      try {
        const p = await offline.newPage();
        await p.goto(`${base}/lab`);
        await expect(p.getByTestId("error-warehouse")).toBeVisible();
        await expect(p.getByTestId("order-row")).toHaveCount(3);
      } finally {
        await offline.close();
      }
    } finally {
      await rename(backup, entry);
    }
    const recovered = await browser.newContext({ javaScriptEnabled: false });
    try {
      const p = await recovered.newPage();
      await p.goto(`${base}/lab`);
      await expect(p.getByTestId("warehouse-panel")).toBeVisible();
    } finally {
      await recovered.close();
    }
  }
});

test("SSR load: 200 authenticated requests stay isolated, finish and release request state", async () => {
  const tokens = { alice: issueSession("alice"), bob: issueSession("bob") };
  for (let i = 0; i < 10; i++)
    await fetch(`${base}/scenarios`, {
      headers: { cookie: `lab_session=${tokens.alice}` },
    }).then((response) => response.text());
  const before = await fetch(`${base}/_lab/metrics?gc=1`).then((response) =>
    response.json(),
  );
  const latencies: number[] = [];
  for (let batch = 0; batch < 20; batch++) {
    await Promise.all(
      Array.from({ length: 10 }, async (_, index) => {
        const user = index % 2 ? "alice" : "bob";
        const started = performance.now();
        const response = await fetch(
          `${base}/scenarios?query=private&page=0&sort=${index % 2 ? "asc" : "desc"}`,
          {
            headers: { cookie: `lab_session=${tokens[user]}` },
            signal: AbortSignal.timeout(15_000),
          },
        );
        expect(response.status).toBe(200);
        const body = await response.text();
        expect(body).toContain(
          user === "alice" ? "Alice private item" : "Bob private item",
        );
        expect(body).not.toContain(
          user === "alice" ? "Bob private item" : "Alice private item",
        );
        latencies.push(performance.now() - started);
      }),
    );
  }
  const after = await fetch(`${base}/_lab/metrics?gc=1`).then((response) =>
    response.json(),
  );
  expect(after.pid).toBe(before.pid);
  expect(after.active).toBe(1); // The metrics request itself.
  expect(after.completed - before.completed).toBeGreaterThanOrEqual(200);
  expect(after.heapUsed - before.heapUsed).toBeLessThan(64 * 1024 * 1024);
  expect(after.rss - before.rss).toBeLessThan(192 * 1024 * 1024);
  latencies.sort((a, b) => a - b);
  await writeFile(
    `test-results/load-${lab.command}.json`,
    JSON.stringify(
      {
        requests: 200,
        concurrency: 10,
        before,
        after,
        p50Ms: latencies[100],
        p95Ms: latencies[190],
        heapBudgetBytes: 64 * 1024 * 1024,
        rssBudgetBytes: 192 * 1024 * 1024,
      },
      null,
      2,
    ),
  );
});

const deployTest = process.env.LAB_RUNTIME === "dev" ? test.skip : test;
deployTest(
  "deployments: compatible remote rebuild works with cached host; changed function IDs fail safely",
  async ({ page }) => {
    await login(page, "alice");
    const before = await fetch(`${base}/_lab/metrics`).then((response) =>
      response.json(),
    );
    const firstBackend = await ordersBackendCode();
    await lab.stopRemote("orders");
    try {
      await lab.buildRemote("orders", { LAB_RELEASE: "v2" });
      await lab.restartRemote("orders");
      expect(await ordersBackendCode()).not.toBe(firstBackend);
      await action(page, () =>
        page.getByRole("button", { name: "Refresh", exact: true }).click(),
      );
      await expect(page.getByTestId("workspace-backend")).toContainText(
        "release v2",
      );
      await page.reload();
      await expect(page.getByTestId("workspace-backend")).toContainText(
        "release v2",
      );
      // SSR text arrives before hydration; do not stop the remote while its
      // browser entry/chunks are still loading for the freshly reloaded page.
      await expect(
        page.getByRole("button", { name: "Refresh", exact: true }),
      ).toBeEnabled();
      expect(
        (
          await fetch(`${base}/_lab/metrics`).then((response) =>
            response.json(),
          )
        ).pid,
      ).toBe(before.pid);
      await lab.stopRemote("orders");
      await lab.buildRemote("orders", {
        LAB_RELEASE: "v3",
        LAB_FUNCTION_EPOCH: "changed",
      });
      await lab.restartRemote("orders");
      await page.getByRole("button", { name: "Refresh", exact: true }).click();
      await expect(page.getByTestId("private-error")).toBeVisible();
      const ssr = await page.context().request.get(`${base}/scenarios`);
      expect(await ssr.text()).toContain('data-testid="private-error"');
      expect(
        (
          await fetch(`${base}/_lab/metrics`).then((response) =>
            response.json(),
          )
        ).pid,
      ).toBe(before.pid);
    } finally {
      await lab.stopRemote("orders");
      await lab.buildRemote("orders");
      await lab.restartRemote("orders");
    }
    await action(page, () =>
      page.getByRole("button", { name: "Refresh", exact: true }).click(),
    );
    await expect(page.getByTestId("workspace-backend")).toContainText(
      "release v1",
    );
  },
);

test("how-to guide: SSR code, lesson navigation, copying and observable backend decisions", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  try {
    const serverPage = await noJs.newPage();
    await serverPage.goto(`${base}/guide`);
    await expect(
      serverPage.getByRole("heading", {
        name: "Microfrontends. One server-rendered page.",
      }),
    ).toBeVisible();
    await expect(
      serverPage.locator('[data-slot="code-block-content"]'),
    ).toContainText("npm ci");
    expect(
      await serverPage
        .locator('[data-slot="code-block-line-content"] span[style]')
        .count(),
    ).toBeGreaterThan(10);
  } finally {
    await noJs.close();
  }
  await page.goto(`${base}/guide`);
  await page
    .getByRole("button", { name: "Browser action", exact: true })
    .click();
  await expect(page.getByTestId("architecture-explanation")).toContainText(
    "allowlisted session cookie",
  );
  await page
    .getByRole("link", { name: "Start a guided lesson", exact: true })
    .click();
  await page.getByRole("button", { name: "Mutations & retries" }).click();
  await expect(
    page.getByRole("heading", {
      name: "What happens if a save is sent twice?",
    }),
  ).toBeVisible();
  const code = page.locator('[data-slot="code-block-content"]:visible');
  await expect(code).toContainText("state.requests.get(requestId)");
  const context = page.context();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Copied", exact: true }),
  ).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split("\n").length).toBeGreaterThan(10);
  expect(copied).toContain("state.requests.get(requestId)");
  await login(page, "bob");
  await page
    .getByLabel("New note", { exact: true })
    .fill("Viewer cannot write");
  await action(
    page,
    () => page.getByRole("button", { name: "Add note", exact: true }).click(),
    403,
  );
  await expect(page.getByTestId("http-response").first()).toHaveAttribute(
    "data-status",
    "403",
  );
  await expect(page.getByTestId("http-response").first()).toContainText(
    "Create item",
  );
  // A saved note can leave the filtered view; the UI must explain how to find it.
  await login(page, "alice");
  const noteTitle = `Clarity ${randomUUID().slice(0, 8)}`;
  await action(page, () =>
    page
      .getByRole("textbox", { name: "Search notes", exact: true })
      .fill(noteTitle),
  );
  await page
    .getByRole("textbox", { name: "New note", exact: true })
    .fill(noteTitle);
  await action(page, () =>
    page.getByRole("button", { name: "Add note", exact: true }).click(),
  );
  await expect(page.getByTestId("private-item")).toHaveCount(1);
  await page.getByText("Edit this note", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Edit note title", exact: true })
    .fill("Renamed outside the current search");
  await action(page, () =>
    page.getByRole("button", { name: "Save changes", exact: true }).click(),
  );
  await expect(page.getByTestId("private-item")).toHaveCount(0);
  await expect(
    page.getByText(`No notes match “${noteTitle}”`, { exact: true }),
  ).toBeVisible();
  await action(page, () =>
    page.getByRole("button", { name: "Show all notes", exact: true }).click(),
  );
  await expect(page.getByTestId("private-workspace")).toContainText(
    "Renamed outside the current search",
  );
  await expect(
    page.getByRole("textbox", { name: "Search notes", exact: true }),
  ).toHaveValue("");
  await page.getByRole("button", { name: "Mutations & retries" }).click();
  await expect(
    page.getByRole("button", { name: "Repeat last save", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Developer details", { exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId("private-query")).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/guide", "/scenarios"]) {
    await page.goto(`${base}${route}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("handbook: topic navigation, keyboard views, ownership outlines and mobile access", async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(base);
  await expect(
    page.getByRole("navigation", { name: "Handbook topics" }),
  ).toBeVisible();
  await expect(page.getByTestId("product-row")).toHaveCount(8);
  const marker = await page.evaluate(() => {
    document.documentElement.dataset.handbookDocument = "retained";
    return "retained";
  });
  await page.getByRole("tab", { name: /^Code/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "catalogRemote.load()",
  );
  await expect(page.getByTestId("remote-panel")).not.toBeVisible();
  await page.getByRole("tab", { name: /^Code/ }).press("ArrowRight");
  await expect(page.getByRole("tab", { name: /^Tests/ })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("npm run test:multi");
  await page.getByRole("tab", { name: /^Tests/ }).press("Home");
  await expect(page.getByTestId("remote-panel")).toBeVisible();
  await page
    .getByRole("button", { name: "Show app boundaries", exact: true })
    .click();
  await expect(page.locator('[data-owner="Catalog"]')).toHaveAttribute(
    "data-outlined",
    "true",
  );
  await expect(page.locator('[data-owner="Host"]')).toHaveAttribute(
    "data-outlined",
    "true",
  );
  await page
    .getByRole("navigation", { name: "Handbook topics" })
    .getByRole("link", { name: /Errors & recovery/ })
    .click();
  for (const owner of ["Host", "Catalog", "Orders", "Warehouse"]) {
    await expect(
      page.locator(`[data-owner="${owner}"]`).first(),
    ).toHaveAttribute("data-outlined", "true");
  }
  expect(
    await page.locator("html").getAttribute("data-handbook-document"),
  ).toBe(marker);
  await page.getByRole("link", { name: /React render error/ }).click();
  await expect(page.getByTestId("error-warehouse")).toBeVisible();
  await expect(page.getByTestId("host-panel")).toBeVisible();
  await page
    .getByRole("link", { name: "Recover all modules", exact: true })
    .click();
  await expect(page.getByTestId("warehouse-panel")).toBeVisible();
  await page
    .getByRole("button", { name: "Hide app boundaries", exact: true })
    .click();
  await expect(page.locator('[data-outlined="true"]')).toHaveCount(0);
  const noJs = await browser.newContext({ javaScriptEnabled: false });
  try {
    const serverPage = await noJs.newPage();
    await serverPage.goto(`${base}/getting-started`);
    await expect(
      serverPage.getByRole("heading", { name: "Start all four apps." }),
    ).toBeVisible();
    await serverPage.goto(`${base}/types`);
    await expect(
      serverPage.getByRole("heading", { name: "What TypeScript checks" }),
    ).toBeVisible();
  } finally {
    await noJs.close();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/guide",
    "/getting-started",
    "/",
    "/scenarios",
    "/lab",
    "/types",
  ]) {
    await page.goto(`${base}${route}`);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Open topics", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Handbook topics" })
    .getByRole("link", { name: /Getting started/ })
    .click();
  await expect(
    page.getByRole("heading", { name: "From checkout to a federated page." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open topics", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    errors.filter(
      (error) => !error.includes("Intentional plain React render failure"),
    ),
  ).toEqual([]);
});
