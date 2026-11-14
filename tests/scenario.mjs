import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { expect } from "@rstest/playwright";

const host = "http://127.0.0.1:3005";
const remote = "http://127.0.0.1:3004";
const rpc = "/_federation/catalog/_serverFn/";

export async function verify({ stopRemote, restartRemote }) {
  const manifest = await (await fetch(`${remote}/mf-manifest.json`)).json();
  assert.deepEqual(
    manifest.exposes.map((item) => item.name),
    ["ServerPanel"],
  );
  assert.equal(manifest.metaData.types.zip, "@mf-types.zip");
  assert.equal((await fetch(`${remote}/@mf-types.zip`)).status, 200);
  const types = await readFile(
    "apps/host/@mf-types/catalog/compiled-types/src/components/ServerPanel.d.ts",
    "utf8",
  );
  assert.ok(
    types.includes("preload"),
    "host downloaded the component's SSR contract",
  );
  for (const origin of [host, remote]) {
    const html = await (await fetch(origin)).text();
    assert.equal(
      (html.match(/data-testid="product-row"/g) ?? []).length,
      8,
      "8 rows arrive in the server HTML",
    );
    assert.ok(
      html.includes("Arc desk lamp"),
      "server function result is rendered before hydration",
    );
    assert.ok(
      html.includes("catalog · PID"),
      "remote backend identity is rendered in SSR",
    );
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1080 },
    });
    const errors = [];
    const calls = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (request.url().includes(rpc)) calls.push(request);
    });
    await page.goto(host);
    await expect(page.getByTestId("product-row")).toHaveCount(8);
    await page.waitForTimeout(600);
    assert.equal(
      calls.length,
      0,
      "hydration reuses SSR data without a second browser RPC",
    );
    const firstPid = (
      await page.getByTestId("server-info").textContent()
    ).match(/PID (\d+)/)[1];
    const firstRows = await page.getByTestId("product-row").allTextContents();
    async function action(run, status = 200) {
      const response = page.waitForResponse((r) => r.url().includes(rpc));
      await run();
      const result = await response;
      assert.equal(
        new URL(result.url()).origin,
        host,
        "browser uses host gateway",
      );
      assert.equal(result.request().method(), "POST");
      assert.equal(result.status(), status);
      if (status === 200)
        await expect(page.locator("[aria-busy]")).toHaveAttribute(
          "aria-busy",
          "false",
        );
      return result;
    }
    await action(() =>
      page.getByRole("button", { name: "Next page", exact: true }).click(),
    );
    await expect(page.getByText("Page 2 of 12", { exact: true })).toBeVisible();
    assert.notDeepEqual(
      await page.getByTestId("product-row").allTextContents(),
      firstRows,
    );
    await action(() =>
      page.getByRole("textbox", { name: "Search products" }).fill("headphones"),
    );
    await expect(page.getByTestId("product-row")).toHaveCount(8);
    for (const row of await page.getByTestId("product-row").allTextContents())
      assert.ok(row.includes("headphones"));
    const sort = await action(() =>
      page.getByRole("button", { name: "Price", exact: true }).click(),
    );
    assert.ok(
      sort.request().postData().includes("price"),
      "sorting travels in the POST body",
    );
    const prices = await page.locator(".price-cell").allTextContents();
    const numbers = prices.map((value) => Number(value.replace(/[^\d.]/g, "")));
    assert.deepEqual(
      numbers,
      [...numbers].sort((a, b) => b - a),
    );
    await action(() =>
      page.getByRole("button", { name: "Clear filters", exact: true }).click(),
    );
    await action(() => page.getByRole("tab", { name: /^Draft/ }).click());
    for (const row of await page.getByTestId("product-row").allTextContents())
      assert.ok(row.includes("Draft"));
    await action(() =>
      page.getByRole("button", { name: "Clear filters", exact: true }).click(),
    );
    await action(() =>
      page
        .getByRole("combobox", { name: "Category", exact: true })
        .selectOption("Stationery"),
    );
    for (const row of await page.getByTestId("product-row").allTextContents())
      assert.ok(row.includes("Stationery"));
    await action(() =>
      page
        .getByRole("textbox", { name: "Search products" })
        .fill("nothing-matches-this-query"),
    );
    await expect(
      page.getByText("No products found", { exact: true }),
    ).toBeVisible();
    await action(() =>
      page.getByRole("button", { name: "Clear filters", exact: true }).click(),
    );
    await action(() =>
      page
        .getByRole("combobox", { name: "Rows per page", exact: true })
        .selectOption("16"),
    );
    await expect(page.getByTestId("product-row")).toHaveCount(16);
    await expect(page.getByText("Page 1 of 6", { exact: true })).toBeVisible();
    await action(() =>
      page.getByRole("button", { name: "Last page", exact: true }).click(),
    );
    await expect(page.getByText("Page 6 of 6", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Next page", exact: true }),
    ).toBeDisabled();
    await action(() =>
      page.getByRole("button", { name: "Previous page", exact: true }).click(),
    );
    await expect(page.getByText("Page 5 of 6", { exact: true })).toBeVisible();
    await action(() =>
      page.getByRole("button", { name: "First page", exact: true }).click(),
    );
    await expect(
      page.getByRole("button", { name: "Previous page", exact: true }),
    ).toBeDisabled();
    await action(() =>
      page
        .getByRole("combobox", { name: "Rows per page", exact: true })
        .selectOption("8"),
    );
    const firstCheckbox = page
      .getByTestId("product-row")
      .first()
      .getByRole("checkbox");
    await firstCheckbox.click();
    await expect(firstCheckbox).toBeChecked();
    await expect(
      page.getByRole("checkbox", { name: "Select page", exact: true }),
    ).toHaveAttribute("data-state", "indeterminate");
    const singleDownloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export selected", exact: true })
      .click();
    const singleCsv = await readFile(
      await (await singleDownloaded).path(),
      "utf8",
    );
    assert.equal(
      singleCsv.split("\r\n").length,
      2,
      "CSV contains only the selected row",
    );
    await firstCheckbox.click();
    await page
      .getByRole("checkbox", { name: "Select page", exact: true })
      .click();
    const downloaded = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export selected", exact: true })
      .click();
    const download = await downloaded;
    const csv = await readFile(await download.path(), "utf8");
    assert.equal(csv.split("\r\n").length, 9);
    await page
      .getByRole("checkbox", { name: "Select page", exact: true })
      .click();

    const standalone = await browser.newPage();
    await standalone.goto(remote);
    assert.ok(
      (await standalone.getByTestId("server-info").textContent()).includes(
        `PID ${firstPid}`,
      ),
      "SSR reaches the standalone backend process",
    );
    await mkdir("test-results", { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: "test-results/catalog-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      "no document overflow on mobile",
    );
    await page.screenshot({
      path: "test-results/catalog-mobile.png",
      fullPage: true,
    });

    await stopRemote();
    await action(
      () =>
        page
          .getByRole("button", { name: "Refresh products", exact: true })
          .click(),
      502,
    );
    await expect(page.getByRole("alert")).toContainText(
      "Catalog is temporarily unavailable",
    );
    await restartRemote();
    await action(() =>
      page.getByRole("button", { name: "Try again", exact: true }).click(),
    );
    await expect(page.getByTestId("product-row")).toHaveCount(8);
    const nextPid = (await page.getByTestId("server-info").textContent()).match(
      /PID (\d+)/,
    )[1];
    assert.notEqual(
      nextPid,
      firstPid,
      "new remote process answers without host restart or page reload",
    );
    assert.deepEqual(errors, [], "no hydration or uncaught browser errors");
    console.log(
      "PASS: SSR rows and backend data, no duplicate hydration RPC, DTS download, pagination, search, sorting, filters, CSV, mobile, 502 and recovery",
    );
  } finally {
    await browser.close();
  }
}
