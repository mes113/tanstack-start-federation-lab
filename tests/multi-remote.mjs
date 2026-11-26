import assert from "node:assert/strict";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { chromium } from "playwright";
import { expect } from "@rstest/playwright";

const base = "http://127.0.0.1:3005";
const catalogRpc = "/_federation/catalog/_serverFn/";
const ordersRpc = "/_federation/orders/_serverFn/";
const hiddenSegment = /<div\b[^>]*\bhidden\b[^>]*\bid="S:[^"]+"/;
const report = [];
function passed(name) {
  report.push({ name, status: "passed" });
  console.log(`PASS: ${name}`);
}

export async function verifyMulti({
  stopRemote,
  restartRemote,
  restartHost,
  command,
}) {
  await mkdir("test-results", { recursive: true });
  const plainPackage = JSON.parse(
    await readFile("apps/react-remote/package.json", "utf8"),
  );
  assert.ok(
    Object.keys(plainPackage.dependencies).every(
      (name) => !name.startsWith("@tanstack/"),
    ),
    "plain React app has no TanStack runtime dependency",
  );
  for (const [port, name, expose] of [
    [3004, "catalog", "ServerPanel"],
    [3006, "orders", "OrdersPanel"],
    [3007, "warehouse", "WarehousePanel"],
  ]) {
    const manifest = await (
      await fetch(`http://127.0.0.1:${port}/mf-manifest.json`)
    ).json();
    assert.deepEqual(
      manifest.exposes.map((item) => item.name),
      [expose],
    );
    assert.equal(manifest.metaData.ssrRemoteEntry.type, "commonjs-module");
    const archive = await fetch(`http://127.0.0.1:${port}/@mf-types.zip`);
    assert.equal(archive.status, 200);
    assert.ok(
      (
        await readFile(`apps/host/@mf-types/${name}/${expose}.d.ts`, "utf8")
      ).includes(expose),
    );
    if (name === "warehouse")
      assert.ok(
        manifest.shared.every((entry) => !entry.name.startsWith("@tanstack/")),
        "plain React remote shares no TanStack runtime",
      );
  }
  if (command === "preview") {
    async function inspectPublicCode(directory) {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) await inspectPublicCode(path);
        else if (/\.(?:js|cjs)$/.test(entry.name)) {
          const source = await readFile(path, "utf8");
          for (const marker of [
            "Jordan Lee",
            "Intentional orders backend failure",
            "Studio headphones",
          ])
            assert.ok(
              !source.includes(marker),
              `backend fixture/handler leaked into ${path}`,
            );
        }
      }
    }
    await Promise.all([
      inspectPublicCode("apps/orders/dist/client"),
      inspectPublicCode("apps/remote/dist/client"),
    ]);
  }
  passed(
    "three component-only exposes, three Node containers, three downloaded type contracts",
  );

  await restartHost();
  const htmlResponses = await Promise.all(
    Array.from({ length: 5 }, () =>
      fetch(`${base}/lab`).then(async (response) => ({
        status: response.status,
        body: await response.text(),
      })),
    ),
  );
  for (const { status, body } of htmlResponses) {
    assert.equal(status, 200);
    assert.doesNotMatch(
      body,
      hiddenSegment,
      "first SSR responses stream remotes inline",
    );
    assert.equal((body.match(/data-testid="product-row"/g) ?? []).length, 8);
    assert.equal((body.match(/data-testid="order-row"/g) ?? []).length, 3);
    for (const expected of [
      "Host server function answered",
      "ORD-2041",
      "Print shipping labels",
      "Tallinn warehouse",
    ])
      assert.ok(body.includes(expected));
  }
  passed(
    "five concurrent full SSR requests compose host data + catalog + orders + plain React",
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const ssr = await browser.newPage({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 1080 },
    });
    await ssr.goto(`${base}/lab`);
    await expect(ssr.getByTestId("product-row")).toHaveCount(8);
    await expect(ssr.getByTestId("order-row")).toHaveCount(3);
    await expect(
      ssr.getByRole("heading", { name: "Fulfillment checklist" }),
    ).toBeVisible();
    assert.equal(
      await ssr
        .getByTestId("warehouse-panel")
        .evaluate((element) => getComputedStyle(element).paddingTop),
      "25px",
      "remote CSS linked during SSR",
    );
    await ssr.screenshot({
      path: "test-results/multi-ssr-no-javascript.png",
      fullPage: true,
    });
    passed("all modules and remote CSS are present with JavaScript disabled");

    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    });
    const browserErrors = [];
    const requests = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes("/_serverFn/")) requests.push(request);
    });
    await page.goto(`${base}/lab`);
    await expect(page.getByTestId("order-row")).toHaveCount(3);
    await page.waitForTimeout(400);
    assert.equal(requests.length, 0, "SSR data reused by all remotes");
    const previousHost = await page.getByTestId("host-server").textContent();
    const hostRpc = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        new URL(response.url()).pathname.includes("/_serverFn/"),
    );
    await page
      .getByRole("button", { name: "Refresh host", exact: true })
      .click();
    const hostReply = await hostRpc;
    assert.equal(hostReply.status(), 200);
    assert.equal(new URL(hostReply.url()).origin, base);
    assert.ok(new URL(hostReply.url()).pathname.startsWith("/_serverFn/"));
    await expect(page.getByTestId("host-server")).not.toHaveText(previousHost);
    const hostPid = (await page.getByTestId("host-server").textContent()).match(
      /PID (\d+)/,
    )[1];
    const catalogPid = (
      await page.getByTestId("server-info").textContent()
    ).match(/PID (\d+)/)[1];
    const ordersPid = (
      await page.getByTestId("orders-server").textContent()
    ).match(/PID (\d+)/)[1];
    assert.equal(
      new Set([hostPid, catalogPid, ordersPid]).size,
      3,
      "three independent backend processes",
    );
    await page.getByRole("checkbox", { name: "Print shipping labels" }).check();
    await expect(page.getByTestId("checklist-progress")).toHaveText(
      "1 of 3 steps complete",
    );
    passed(
      "hydration shares React, preserves SSR data, and activates the frameworkless React remote",
    );

    async function rpc(run, path, status = 200) {
      const waiting = page.waitForResponse((response) =>
        response.url().includes(path),
      );
      await run();
      const response = await waiting;
      assert.equal(response.status(), status);
      assert.equal(new URL(response.url()).origin, base);
      return response;
    }
    let catalogResponse, ordersResponse;
    for (let round = 0; round < 3; round++) {
      [catalogResponse, ordersResponse] = await Promise.all([
        rpc(
          () =>
            page
              .getByRole("button", { name: "Refresh products", exact: true })
              .dispatchEvent("click"),
          catalogRpc,
        ),
        rpc(
          () =>
            page
              .getByRole("button", { name: "Refresh orders", exact: true })
              .dispatchEvent("click"),
          ordersRpc,
        ),
        rpc(
          () =>
            page
              .getByRole("button", { name: "Refresh host", exact: true })
              .dispatchEvent("click"),
          `${base}/_serverFn/`,
        ),
      ]);
      await expect(page.getByTestId("orders-panel")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await expect(page.locator(".table-scroll")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      assert.ok(
        (await page.getByTestId("server-info").textContent()).includes(
          `PID ${catalogPid}`,
        ),
      );
      assert.ok(
        (await page.getByTestId("orders-server").textContent()).includes(
          `PID ${ordersPid}`,
        ),
      );
    }
    if (command === "preview") {
      assert.equal(
        new URL(catalogResponse.url()).pathname.slice(catalogRpc.length),
        new URL(ordersResponse.url()).pathname.slice(ordersRpc.length),
        "production functions actually share an ID",
      );
      passed(
        "colliding production function IDs reach their own backends during SSR and concurrent browser POSTs",
      );
    } else
      passed(
        "concurrent dev POSTs stay isolated across both backend namespaces",
      );

    await page.getByText("Backend & fault checks", { exact: true }).click();
    await rpc(
      () =>
        page
          .getByRole("button", { name: "Simulate orders error", exact: true })
          .click(),
      ordersRpc,
      200,
    );
    await expect(page.getByTestId("orders-error")).toBeVisible();
    await expect(page.getByTestId("product-row")).toHaveCount(8);
    await page.screenshot({
      path: "test-results/orders-browser-error.png",
      fullPage: true,
    });
    await rpc(
      () =>
        page.getByRole("button", { name: "Retry orders", exact: true }).click(),
      ordersRpc,
    );
    await expect(page.getByTestId("order-row")).toHaveCount(3);
    await rpc(
      () =>
        page
          .getByRole("button", { name: "Simulate orders timeout", exact: true })
          .click(),
      ordersRpc,
      502,
    );
    await expect(page.getByTestId("orders-error")).toBeVisible();
    await rpc(
      () =>
        page.getByRole("button", { name: "Retry orders", exact: true }).click(),
      ordersRpc,
    );
    await expect(page.getByTestId("order-row")).toHaveCount(3);
    passed(
      "serialized backend exceptions (HTTP 200), forwarding timeout (502), error screens and retry are isolated",
    );

    for (const fault of ["orders-data", "orders-timeout", "react-render"]) {
      await ssr.goto(`${base}/lab?fault=${fault}`);
      await expect(
        ssr.getByTestId(
          fault === "react-render" ? "error-warehouse" : "orders-error",
        ),
      ).toBeVisible();
      await expect(ssr.getByTestId("product-row")).toHaveCount(8);
      await expect(ssr.getByTestId("host-panel")).toBeVisible();
      await ssr.screenshot({
        path: `test-results/${fault}-ssr.png`,
        fullPage: true,
      });
      if (fault === "orders-data")
        await ssr
          .locator(".lab-grid")
          .screenshot({ path: "test-results/multi-error-panels.png" });
    }
    passed(
      "server-rendered error screens for backend error, timeout and React render failure with JS disabled",
    );

    const loaderFailure = await ssr.goto(`${base}/lab?fault=host-loader`);
    assert.equal(loaderFailure.status(), 500);
    await expect(ssr.getByTestId("host-error-screen")).toBeVisible();
    await ssr.screenshot({
      path: "test-results/host-loader-ssr-error.png",
      fullPage: true,
    });
    const missing = await ssr.goto(`${base}/this-page-does-not-exist`);
    assert.equal(missing.status(), 404);
    await expect(ssr.getByTestId("not-found-screen")).toBeVisible();
    passed("host loader 500 and missing-route 404 render real SSR error pages");

    await page.getByText("Render fault check", { exact: true }).click();
    await page
      .getByRole("button", { name: "Simulate React crash", exact: true })
      .click();
    await expect(page.getByTestId("error-warehouse")).toBeVisible();
    await expect(page.getByTestId("order-row")).toHaveCount(3);
    await page.screenshot({
      path: "test-results/react-browser-render-error.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Retry warehouse render", exact: true })
      .click();
    await expect(page.getByTestId("warehouse-panel")).toBeVisible();
    await page
      .getByRole("button", { name: "Simulate host crash", exact: true })
      .click();
    await expect(page.getByTestId("error-host")).toBeVisible();
    await expect(page.getByTestId("order-row")).toHaveCount(3);
    await page
      .getByRole("button", { name: "Retry host render", exact: true })
      .click();
    await expect(page.getByTestId("host-panel")).toBeVisible();
    assert.ok(
      browserErrors.every(
        (message) =>
          message.includes("Intentional plain React render failure") ||
          message.includes("Intentional host component render failure"),
      ),
      `unexpected browser errors: ${browserErrors.join("; ")}`,
    );
    passed(
      "browser render errors in React remote and host component are bounded and recover independently",
    );

    await stopRemote("orders");
    await rpc(
      () =>
        page
          .getByRole("button", { name: "Refresh orders", exact: true })
          .click(),
      ordersRpc,
      502,
    );
    await rpc(
      () =>
        page
          .getByRole("button", { name: "Refresh products", exact: true })
          .click(),
      catalogRpc,
    );
    await expect(page.getByTestId("orders-error")).toBeVisible();
    await restartRemote("orders");
    await rpc(
      () =>
        page.getByRole("button", { name: "Retry orders", exact: true }).click(),
      ordersRpc,
    );
    await expect(page.getByTestId("order-row")).toHaveCount(3);
    const recoveredPid = (
      await page.getByTestId("orders-server").textContent()
    ).match(/PID (\d+)/)[1];
    assert.notEqual(recoveredPid, ordersPid);
    passed(
      "orders outage returns 502 while catalog stays live; recovery uses a new PID without reloading",
    );

    await Promise.all([stopRemote("orders"), stopRemote("react-remote")]);
    await restartHost();
    await ssr.goto(`${base}/lab`);
    await expect(ssr.getByTestId("error-orders")).toBeVisible();
    await expect(ssr.getByTestId("error-warehouse")).toBeVisible();
    await expect(ssr.getByTestId("product-row")).toHaveCount(8);
    await expect(ssr.getByTestId("manifest-orders")).toContainText(
      "TANSTACK-REMOTE-FETCH-NETWORK",
    );
    await expect(ssr.getByTestId("manifest-warehouse")).toContainText(
      "TANSTACK-REMOTE-FETCH-NETWORK",
    );
    await expect(ssr.getByTestId("manifest-catalog")).toContainText(
      "Manifest loaded.",
    );
    await ssr.screenshot({
      path: "test-results/cold-host-two-remotes-offline.png",
      fullPage: true,
    });
    await restartRemote("orders");
    const ordersRecovery = await ssr.goto(`${base}/lab`);
    assert.equal(ordersRecovery.status(), 200);
    assert.doesNotMatch(await ordersRecovery.text(), hiddenSegment);
    await expect(ssr.getByTestId("order-row")).toHaveCount(3);
    await expect(ssr.getByTestId("order-row").first()).toBeVisible();
    await expect(ssr.getByTestId("manifest-orders")).toContainText(
      "Manifest loaded.",
    );
    await expect(ssr.getByTestId("error-warehouse")).toBeVisible();
    await restartRemote("react-remote");
    const warehouseRecovery = await ssr.goto(`${base}/lab`);
    assert.equal(warehouseRecovery.status(), 200);
    assert.doesNotMatch(await warehouseRecovery.text(), hiddenSegment);
    await expect(ssr.getByTestId("warehouse-panel")).toBeVisible();
    await expect(ssr.getByTestId("manifest-warehouse")).toContainText(
      "Manifest loaded.",
    );
    await expect(ssr.getByTestId("order-row")).toHaveCount(3);
    assert.equal(
      await ssr
        .getByTestId("warehouse-panel")
        .evaluate((element) => getComputedStyle(element).paddingTop),
      "25px",
    );
    await ssr.screenshot({
      path: "test-results/multi-ssr-recovered.png",
      fullPage: true,
    });
    passed(
      "cold host starts with two unavailable remote entries and recovers both without another host restart",
    );
  } finally {
    await browser.close();
    await writeFile(
      `test-results/multi-remote-${command}.json`,
      JSON.stringify({ mode: command, scenarios: report }, null, 2),
    );
  }
}
