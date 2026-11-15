import { beforeAll, expect, test } from "@rstest/core";
import { createRemoteServerFunctions } from "@module-federation/tanstack/server-functions";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { runWithStartContext } from "@tanstack/start-storage-context";
import { forwardSessionCookie, issueSession } from "@lab/session";
import { readFile } from "node:fs/promises";

function requestContext<T>(run: () => T, user?: "alice" | "bob") {
  return runWithStartContext(
    {
      request: new Request("http://federation-test.local/", {
        headers: {
          cookie: `unrelated=private; ${user ? `lab_session=${issueSession(user)}` : ""}`,
          authorization: "Bearer never-forward-this",
        },
      }),
      startOptions: {},
      contextAfterGlobalMiddlewares: {},
      handlerType: "router",
      getRouter: () => {
        throw new Error("No navigation expected in this SSR fixture");
      },
    },
    run,
  );
}

beforeAll(() => {
  createRemoteServerFunctions({
    remotes: {
      catalog: { origin: "http://127.0.0.1:3404" },
      orders: {
        origin: "http://127.0.0.1:3406",
        headers: ({ request }) => ({
          cookie: forwardSessionCookie(request?.headers.get("cookie")),
        }),
      },
    },
  });
});

const workspaceQuery = { query: "", delayMs: 0, page: 0, sort: "asc" } as const;

test("repeated dynamic imports preserve the remote component's identity", async () => {
  const first = await import("warehouse/WarehousePanel");
  expect((await import("warehouse/WarehousePanel")).default).toBe(
    first.default,
  );
});

test("loads the real plain React remote and renders its hooks through shared React", async () => {
  const { default: Warehouse } = await import("warehouse/WarehousePanel");
  const html = renderToString(
    createElement(Warehouse, {
      warehouse: "Rstest warehouse",
      openOrders: 7,
    }),
  );
  expect(html).toContain('data-testid="warehouse-panel"');
  expect(html).toContain("Rstest warehouse");
  expect(html.replaceAll("<!-- -->", "")).toContain("7 open orders");
});

test("calls the catalog component's private preload and renders returned rows in SSR", async () => {
  const { default: Catalog } = await import("catalog/ServerPanel");
  const data = await requestContext(() => Catalog.preload());
  expect(data.server.app).toBe("catalog");
  expect(data.server.pid).not.toBe(process.pid);
  expect(data.rows).toHaveLength(8);
  const html = renderToString(
    createElement(Catalog, {
      title: "Federated SSR catalog",
      initialData: data,
    }),
  );
  expect(html.match(/data-testid="product-row"/g)).toHaveLength(8);
  expect(html).toContain("Arc desk lamp");
});

test("catalog error state is real SSR HTML when its preload has no data", async () => {
  const { default: Catalog } = await import("catalog/ServerPanel");
  const html = renderToString(
    createElement(Catalog, { title: "Unavailable catalog", initialData: null }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain("Catalog is temporarily unavailable");
  expect(html).not.toContain('data-testid="product-row"');
});

test("orders owns its preload and renders backend data using the same React renderer", async () => {
  const { default: Orders } = await import("orders/OrdersPanel");
  const data = await requestContext(() => Orders.preload({ delayMs: 0 }));
  expect(data.server.app).toBe("orders");
  expect(data.server.pid).not.toBe(process.pid);
  expect(data.rows).toHaveLength(3);
  const html = renderToString(createElement(Orders, { initialData: data }));
  expect(html.match(/data-testid="order-row"/g)).toHaveLength(3);
  expect(html).toContain(data.rows[0].customer);
});

test("concurrent preloads reach the correct independent backend processes", async () => {
  const [{ default: Catalog }, { default: Orders }] = await Promise.all([
    import("catalog/ServerPanel"),
    import("orders/OrdersPanel"),
  ]);
  const [catalog, orders] = await Promise.all([
    requestContext(() => Catalog.preload()),
    requestContext(() => Orders.preload({ delayMs: 0 })),
  ]);
  expect(catalog.server.app).toBe("catalog");
  expect(orders.server.app).toBe("orders");
  expect(catalog.server.pid).not.toBe(orders.server.pid);
});

test("remote backend errors reject preload, render a fallback and allow a later success", async () => {
  const { default: Orders } = await import("orders/OrdersPanel");
  await expect(
    requestContext(() => Orders.preload({ fail: true, delayMs: 0 })),
  ).rejects.toThrow();
  const html = renderToString(createElement(Orders, { initialData: null }));
  expect(html).toContain('data-testid="orders-error"');
  expect(html).toContain("Orders temporarily unavailable");
  const recovered = await requestContext(() => Orders.preload({ delayMs: 0 }));
  expect(recovered.rows).toHaveLength(3);
});

test("private preload denies an anonymous SSR request", async () => {
  const { default: Orders } = await import("orders/OrdersPanel");
  await expect(
    requestContext(() => Orders.preloadWorkspace(workspaceQuery)),
  ).rejects.toThrow();
});

test.each(["alice", "bob"] as const)(
  "private SSR shows only %s's data and forwards only the session cookie",
  async (user) => {
    const { default: Orders } = await import("orders/OrdersPanel");
    const data = await requestContext(
      () => Orders.preloadWorkspace(workspaceQuery),
      user,
    );
    expect(data.actor.user).toBe(user);
    expect(data.receivedAuthorization).toBe(false);
    expect(data.receivedUnrelatedCookie).toBe(false);
    const html = renderToString(
      createElement(Orders.Workspace, {
        initialData: data,
        initialQuery: "",
        initialPage: 0,
        initialSort: "asc",
      }),
    );
    expect(html).toContain(
      user === "alice" ? "Alice private item" : "Bob private item",
    );
    expect(html).not.toContain(
      user === "alice" ? "Bob private item" : "Alice private item",
    );
  },
);

test("concurrent SSR contexts keep two users' cookies and private data isolated", async () => {
  const { default: Orders } = await import("orders/OrdersPanel");
  const results = await Promise.all(
    Array.from({ length: 10 }, (_, index) => {
      const user = index % 2 ? "alice" : "bob";
      return requestContext(
        async () => ({
          user,
          data: await Orders.preloadWorkspace(workspaceQuery),
        }),
        user,
      );
    }),
  );
  for (const { user, data } of results) {
    expect(data.actor.user).toBe(user);
    expect(data.notes.map((note) => note.id)).toEqual([`${user}-seed`]);
  }
});

test("the plain React remote's render failure propagates to the SSR caller", async () => {
  const { default: Warehouse } = await import("warehouse/WarehousePanel");
  expect(() =>
    renderToString(
      createElement(Warehouse, {
        warehouse: "Fault",
        openOrders: 0,
        crash: true,
      }),
    ),
  ).toThrow("Intentional plain React render failure");
});

test("a private server-function module cannot be imported through federation", async () => {
  // @ts-expect-error private module deliberately has no federated type contract
  await expect(import("catalog/server-functions")).rejects.toThrow();
});

test.each([
  ["apps/remote/dist/client", "ServerPanel"],
  ["apps/orders/dist/client", "OrdersPanel"],
  ["apps/react-remote/dist", "WarehousePanel"],
])("%s publishes only its UI module", async (directory, expose) => {
  const manifest = JSON.parse(
    await readFile(`${directory}/mf-manifest.json`, "utf8"),
  );
  expect(manifest.exposes.map((entry: { name: string }) => entry.name)).toEqual(
    [expose],
  );
  expect(manifest.metaData.ssrRemoteEntry.name).toBe("remoteEntry.ssr.cjs");
});
