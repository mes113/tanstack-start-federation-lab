import { expect, test } from "@rstest/core";
import {
  beginTrace,
  endTrace,
  traceHeaders,
  traceResponse,
} from "../apps/host/src/request-trace";
import { validateProductsInput } from "../apps/remote/src/catalog-input";
import { queryProducts } from "../apps/remote/src/catalog-query";
import { products } from "../apps/remote/src/data/products";
import type { ProductsInput } from "../apps/remote/src/types";
import {
  addedLines,
  changedCoverage,
  comparisonMarkdown,
  parseLcov,
} from "../scripts/coverage-compare.mjs";

const query: ProductsInput = {
  pageIndex: 0,
  pageSize: 8,
  search: "",
  status: "All",
  category: "All",
  sortBy: "name",
  desc: false,
};
test("accepts the supported catalog query and returns an empty result for no matches", () => {
  expect(validateProductsInput(query)).toEqual(query);
  const result = queryProducts(products, {
    ...query,
    search: "does-not-exist",
  });
  expect(result.rows).toEqual([]);
  expect(result.rowCount).toBe(0);
  expect(result.stats).toEqual({ lowStock: 17, value: 759684 });
});
test.each([
  { pageIndex: -1 },
  { pageIndex: 0.5 },
  { pageSize: 7 },
  { search: "x".repeat(121) },
  { status: "unknown" },
  { category: "unknown" },
  { sortBy: "unknown" },
  { desc: "true" },
])("rejects invalid catalog input %#", (overrides) => {
  expect(() =>
    validateProductsInput({ ...query, ...overrides } as ProductsInput),
  ).toThrow("Invalid catalog query");
});
test("catalog applies search on the backend and returns the real filtered count", () => {
  const result = queryProducts(products, {
    ...query,
    search: "  HEADPHONES  ",
    category: "Electronics",
    sortBy: "price",
    desc: true,
  });
  expect(result.rowCount).toBe(8);
  expect(
    result.rows.every((row) => row.name.toLowerCase().includes("headphones")),
  ).toBe(true);
  const prices = result.rows.map((row) => row.price);
  expect(prices).toEqual([...prices].sort((a, b) => b - a));
});
test("catalog keeps global counts while paging a filtered result", () => {
  const result = queryProducts(products, {
    ...query,
    status: "Draft",
    pageIndex: 2,
  });
  expect(result.counts).toEqual({
    All: 96,
    Active: 68,
    Draft: 17,
    Archived: 11,
  });
  expect(result.rowCount).toBe(17);
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].status).toBe("Draft");
  expect(
    queryProducts(products, { ...query, status: "Draft", pageIndex: 3 }).rows,
  ).toHaveLength(0);
});
test("catalog sorting never mutates the backend fixture and uses stable ID ties", () => {
  const before = products.map((row) => row.id);
  queryProducts(products, { ...query, sortBy: "stock", desc: true });
  expect(products.map((row) => row.id)).toEqual(before);
  const ties = [
    { ...products[0], id: "b" },
    { ...products[0], id: "a" },
  ];
  expect(queryProducts(ties, query).rows.map((row) => row.id)).toEqual([
    "a",
    "b",
  ]);
});
test("host creates an independent ID for each request and ignores a caller's ID", async () => {
  const first = new Request("http://host/_federation/catalog/_serverFn/id", {
    headers: { "x-lab-request-id": "untrusted" },
  });
  const second = new Request("http://host/_federation/orders/_serverFn/id");
  const a = beginTrace(first),
    b = beginTrace(second);
  expect(a.id).not.toBe(b.id);
  expect(a.id).not.toBe("untrusted");
  expect(traceHeaders(first)["x-lab-request-id"]).toBe(a.id);
  const response = traceResponse(
    new Response("ok", { headers: { "set-cookie": "demo=value; HttpOnly" } }),
    a,
  );
  expect(response.headers.get("x-lab-route")).toBe("catalog");
  expect(response.headers.get("server-timing")).toMatch(
    /^lab;dur=\d+(\.\d+)?$/,
  );
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  expect(await response.text()).toBe("ok");
  endTrace(first);
  endTrace(second);
  expect(traceHeaders(first)).toEqual({});
  expect(traceHeaders()).toEqual({});
});
test("host route metadata does not copy query strings or credentials", () => {
  const request = new Request("http://host/scenarios?private=secret");
  const trace = beginTrace(request);
  expect(trace.route).toBe("host");
  expect(JSON.stringify(trace)).not.toContain("secret");
  endTrace(request);
});
test("changed-line parsing handles additions and deletions without guessing executable lines", () => {
  const added = addedLines("@@ -1,2 +1,3 @@\n@@ -8 +10 @@\n@@ -20,2 +22,0 @@");
  expect([...added]).toEqual([1, 2, 3, 10]);
  const coverage = parseLcov(
    "SF:apps/example.ts\nDA:1,1\nDA:3,0\nDA:10,2\nend_of_record\n",
  );
  const result = changedCoverage(
    new Map([
      ["apps/example.ts", added],
      ["apps/style.css", new Set([1])],
    ]),
    coverage,
  );
  expect(result).toEqual({ total: 3, covered: 2, unmeasuredFiles: 1 });
});
const metric = { total: 10, covered: 8, pct: 80 };
const total = {
  lines: metric,
  statements: metric,
  functions: metric,
  branches: metric,
};
const comparison = {
  baseSha: "a".repeat(40),
  testedSha: "b".repeat(40),
  head: total,
  base: { ...total, lines: { total: 10, covered: 7, pct: 70 } },
  changed: { total: 4, covered: 3, unmeasuredFiles: 0 },
};
test("coverage reports percentage-point delta and measured changed lines", () => {
  const text = comparisonMarkdown(comparison);
  expect(text).toContain("+10.00");
  expect(text).toContain("75.00%");
  expect(text).toContain("3/4");
});
test("coverage distinguishes unavailable base from a real zero delta", () => {
  const text = comparisonMarkdown({
    ...comparison,
    base: null,
    changed: { covered: 0, total: 0, unmeasuredFiles: 2 },
  });
  expect(text).toContain("Base coverage unavailable");
  expect(text).toContain("No changed executable lines");
});
test("coverage rejects inconsistent numbers and non-commit identities", () => {
  expect(() =>
    comparisonMarkdown({ ...comparison, baseSha: "@someone" }),
  ).toThrow("identity");
  expect(() =>
    comparisonMarkdown({
      ...comparison,
      head: { ...total, lines: { ...metric, pct: 999 } },
    }),
  ).toThrow("Invalid coverage metric");
  expect(() =>
    comparisonMarkdown({
      ...comparison,
      changed: { covered: 5, total: 1, unmeasuredFiles: 0 },
    }),
  ).toThrow("changed-line");
});
