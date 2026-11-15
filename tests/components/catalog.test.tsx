import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test } from "@rstest/core";
import ServerPanel from "../../apps/remote/src/components/ServerPanel";
import { listProducts } from "./catalog-rpc";
import { queryProducts } from "../../apps/remote/src/catalog-query";
import { products } from "../../apps/remote/src/data/products";

const initialQuery = {
  pageIndex: 0,
  pageSize: 8,
  search: "",
  status: "All",
  category: "All",
  sortBy: "name" as const,
  desc: false,
};
const snapshot = (search = "") => ({
  ...queryProducts(products, { ...initialQuery, search }),
  server: {
    app: "catalog" as const,
    pid: 123,
    time: "2026-11-15T00:00:00.000Z",
    requestId: "test-request-id",
    viaHost: true,
    durationMs: 280,
  },
});
const rpc = listProducts;
beforeEach(() => {
  rpc.mockReset();
});

test("renders SSR rows and trace without fetching the same data again", async () => {
  render(<ServerPanel title="Products" initialData={snapshot()} />);
  expect(screen.getAllByTestId("product-row")).toHaveLength(8);
  expect(screen.getByTestId("trace-catalog").textContent).toContain(
    "SSR preload",
  );
  expect(screen.getByTestId("trace-id-catalog").textContent).toBe(
    "test-request-id",
  );
  await userEvent.click(screen.getByRole("checkbox", { name: "Select page" }));
  expect(screen.getByRole("button", { name: "Export selected" })).toBeDefined();
  expect(rpc).not.toHaveBeenCalled();
});

test("a status tab requests backend filtering and resets the page", async () => {
  rpc.mockImplementation(async ({ data }) => ({
    ...snapshot(),
    ...queryProducts(products, data),
  }));
  render(<ServerPanel title="Products" initialData={snapshot()} />);
  await userEvent.click(screen.getByRole("button", { name: "Next page" }));
  await waitFor(() =>
    expect(rpc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pageIndex: 1 }),
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.getAllByTestId("product-row")).toHaveLength(8),
  );
  await userEvent.click(screen.getByRole("tab", { name: /Draft/ }));
  await waitFor(() =>
    expect(rpc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "Draft", pageIndex: 0 }),
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId("catalog-observation").textContent).toContain(
      "17 matching products",
    ),
  );
});

test("shows an actionable failure and recovers when retry succeeds", async () => {
  rpc
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce(snapshot());
  render(<ServerPanel title="Products" initialData={snapshot()} />);
  await userEvent.click(
    screen.getByRole("button", { name: "Refresh products" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Catalog is temporarily unavailable",
  );
  await userEvent.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getAllByTestId("product-row")).toHaveLength(8);
  expect(rpc).toHaveBeenCalledTimes(2);
});

test("a slow older search cannot overwrite the newest result", async () => {
  let resolveOld!: (value: ReturnType<typeof snapshot>) => void;
  rpc.mockImplementation(({ data }) =>
    data.search === "a"
      ? new Promise((resolve) => {
          resolveOld = resolve;
        })
      : Promise.resolve(snapshot(data.search)),
  );
  render(<ServerPanel title="Products" initialData={snapshot()} />);
  const search = screen.getByRole("textbox", { name: "Search products" });
  await userEvent.type(search, "a");
  await waitFor(() => expect(resolveOld).toBeDefined());
  await userEvent.type(search, "rc desk");
  await waitFor(() =>
    expect(rpc).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ search: "arc desk" }),
      }),
    ),
  );
  await waitFor(() =>
    expect(screen.getByTestId("catalog-observation").textContent).toContain(
      "8 matching products",
    ),
  );
  await act(async () => resolveOld(snapshot("a")));
  expect(screen.getByTestId("catalog-observation").textContent).toContain(
    "8 matching products",
  );
});
