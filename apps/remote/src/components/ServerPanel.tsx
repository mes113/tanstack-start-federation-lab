import { useEffect, useMemo, useRef, useState } from "react";
import { RequestTrace, type RequestObservation } from "@lab/ui/request-trace";
import {
  flexRender,
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowDownToLine,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Search,
  RefreshCw,
  SlidersHorizontal,
  AlertCircle,
  Box,
  CircleDollarSign,
  Layers,
  X,
} from "lucide-react";
import { listProducts } from "../server-functions";
import type { Product, ProductsInput } from "../types";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { Checkbox } from "./ui/checkbox";
import { Skeleton } from "./ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card, CardContent } from "./ui/card";
import "../styles.css";

type Result = Awaited<ReturnType<typeof listProducts>>;
export interface ServerPanelProps {
  title: string;
  initialData: Result | null;
}
const initialQuery: ProductsInput = {
  pageIndex: 0,
  pageSize: 8,
  search: "",
  status: "All",
  category: "All",
  sortBy: "name",
  desc: false,
};
const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
const statuses = ["All", "Active", "Draft", "Archived"] as const;
// The backend owns filtering, sorting and pagination; no client row models are needed.
const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
});

function ServerPanelView({ title, initialData }: ServerPanelProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 8,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [data, setData] = useState<Result | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    initialData
      ? ""
      : "We couldn’t load your products. Check the catalog connection and try again.",
  );
  const [revision, setRevision] = useState(0);
  const [observation, setObservation] = useState<RequestObservation>({
    source: "ssr",
    requestId: initialData?.server.requestId,
    backendMs: initialData?.server.durationMs,
    viaHost: initialData?.server.viaHost,
  });
  const [selection, setSelection] = useState({});
  const lastLoaded = useRef(
    initialData ? JSON.stringify({ ...initialQuery, revision: 0 }) : "",
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== debouncedSearch) {
        setDebouncedSearch(search);
        setPagination((p) => ({ ...p, pageIndex: 0 }));
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);
  useEffect(() => {
    const sort = sorting[0];
    const query: ProductsInput = {
      ...pagination,
      search: debouncedSearch,
      status,
      category,
      sortBy: (sort?.id ?? "name") as ProductsInput["sortBy"],
      desc: sort?.desc ?? false,
    };
    const key = JSON.stringify({ ...query, revision });
    if (lastLoaded.current === key) {
      setLoading(false);
      setError("");
      return;
    }
    let current = true;
    setLoading(true);
    setError("");
    setSelection({});
    listProducts({
      data: query,
      fetch: async (input, init) => {
        const start = performance.now();
        try {
          const response = await globalThis.fetch(input, init);
          if (current)
            setObservation({
              source: "browser",
              requestId: response.headers.get("x-lab-request-id") ?? undefined,
              status: response.status,
              viaHost: response.headers.has("x-lab-request-id"),
              durationMs: Math.round(performance.now() - start),
            });
          return response;
        } catch (error) {
          if (current)
            setObservation({
              source: "browser",
              status: null,
              durationMs: Math.round(performance.now() - start),
            });
          throw error;
        }
      },
    })
      .then((result) => {
        if (current) {
          setData(result);
          setObservation((value) => ({
            ...value,
            requestId: result.server.requestId,
            viaHost: result.server.viaHost,
          }));
          lastLoaded.current = key;
        }
      })
      .catch(() => {
        if (current)
          setError(
            "We couldn’t load your products. Check the catalog connection and try again.",
          );
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [pagination, sorting, debouncedSearch, status, category, revision]);

  const columns = useMemo<ColumnDef<typeof features, Product>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            aria-label="Select page"
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.sku}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "name",
        header: "Product",
        cell: ({ row }) => (
          <div className="product-cell">
            <div className={`product-thumbnail ${row.original.color}`}>
              <Package size={22} strokeWidth={1.4} />
            </div>
            <div>
              <div className="product-name">{row.original.name}</div>
              <div className="product-sku">{row.original.sku}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => (
          <Badge
            variant="secondary"
            className={`status-badge ${row.original.status.toLowerCase()}`}
          >
            <span />
            {row.original.status}
          </Badge>
        ),
      },
      { accessorKey: "category", header: "Category", enableSorting: false },
      {
        accessorKey: "stock",
        header: "Inventory",
        cell: ({ row }) => (
          <span
            className={
              row.original.stock === 0
                ? "stock-empty"
                : row.original.stock < 20
                  ? "stock-low"
                  : "stock-count"
            }
          >
            <span className="stock-dot" />
            {row.original.stock === 0
              ? "Out of stock"
              : `${row.original.stock} in stock`}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ row }) => (
          <span className="price-cell">{money(row.original.price)}</span>
        ),
      },
    ],
    [],
  );
  const table = useTable({
    features,
    data: data?.rows ?? [],
    columns,
    rowCount: data?.rowCount ?? 0,
    state: { pagination, sorting, rowSelection: selection },
    onPaginationChange: setPagination,
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((p) => ({ ...p, pageIndex: 0 }));
    },
    onRowSelectionChange: setSelection,
    getRowId: (row) => row.id,
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
  });
  function changeFilter(set: (value: string) => void, value: string) {
    set(value);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }
  function exportPage() {
    const rows = table.getSelectedRowModel().rows.length
      ? table.getSelectedRowModel().rows.map((r) => r.original)
      : (data?.rows ?? []);
    const csv = [
      ["SKU", "Product", "Status", "Category", "Stock", "Price"],
      ...rows.map((p) => [
        p.sku,
        p.name,
        p.status,
        p.category,
        p.stock,
        p.price,
      ]),
    ]
      .map((row) =>
        row
          .map((value) => `"${String(value).replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "catalog-products.csv";
    link.click();
    URL.revokeObjectURL(url);
  }
  const filtered = status !== "All" || category !== "All" || search !== "";
  return (
    <section className="catalog-page" data-testid="remote-panel">
      <div className="page-heading">
        <div>
          <div className="section-eyebrow">YOUR WORKSPACE, IN ORDER</div>
          <h1>{title}</h1>
          <p>
            Good things, all in one place. Manage and explore your product
            catalog.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={exportPage}
          disabled={loading || !!error || !data?.rows.length}
        >
          <ArrowDownToLine />
          Export {Object.keys(selection).length ? "selected" : "page"}
        </Button>
      </div>
      <div className="stats-grid">
        {[
          {
            label: "Total products",
            value: data?.counts.All,
            hint: "Across your entire catalog",
            icon: Package,
            accent: "violet",
          },
          {
            label: "Active products",
            value: data?.counts.Active,
            hint: "Live and ready to discover",
            icon: Layers,
            accent: "green",
          },
          {
            label: "Low inventory",
            value: data?.stats.lowStock,
            hint: "Products with fewer than 20 units",
            icon: Box,
            accent: "amber",
          },
          {
            label: "Inventory value",
            value: data ? money(data.stats.value) : undefined,
            hint: "Total value of stock on hand",
            icon: CircleDollarSign,
            accent: "blue",
          },
        ].map((stat) => (
          <Card key={stat.label} className="stat-card">
            <CardContent>
              <div className="stat-top">
                <span>{stat.label}</span>
                <div className={`stat-icon ${stat.accent}`}>
                  <stat.icon size={17} />
                </div>
              </div>
              <div className="stat-value">
                {stat.value ?? <Skeleton className="h-8 w-20" />}
              </div>
              <p>{stat.hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="catalog-table-card">
        <RequestTrace app="catalog" observation={observation} />
        <div
          className="catalog-observation"
          role="status"
          aria-live="polite"
          data-testid="catalog-observation"
        >
          <span>REMOTE RESULT</span>
          <p>
            {loading || search !== debouncedSearch
              ? "Updating the catalog…"
              : error
                ? "Request failed. Use Try again below to retry."
                : `${data?.rows.length ?? 0} rows on this page · ${data?.rowCount ?? 0} matching products`}
          </p>
          <small>
            Search, filters and pages are processed by the catalog backend.
          </small>
        </div>
        <div className="table-card-heading">
          <div>
            <h2>
              All products{" "}
              <Badge variant="secondary">{data?.counts.All ?? "…"}</Badge>
            </h2>
            <p>A little structure for everything you sell.</p>
          </div>
          <span className="live-indicator">
            <span />
            Live catalog
          </span>
        </div>
        <Tabs
          value={status}
          onValueChange={(value) => changeFilter(setStatus, value)}
          activationMode="manual"
        >
          <TabsList
            className="table-tabs"
            variant="line"
            aria-label="Product status"
          >
            {statuses.map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {tab === "All" ? "All products" : tab}
                <span>{data?.counts[tab] ?? "–"}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={17} />
            <Input
              aria-label="Search products"
              placeholder="Search products or SKU…"
              value={search}
              maxLength={120}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="toolbar-actions">
            <Select
              value={category}
              onValueChange={(value) => changeFilter(setCategory, value)}
            >
              <SelectTrigger aria-label="Category" className="category-filter">
                <SlidersHorizontal size={15} />
                <SelectValue>
                  {category === "All" ? "All categories" : category}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {[
                  "All",
                  "Electronics",
                  "Accessories",
                  "Home & living",
                  "Stationery",
                ].map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === "All" ? "All categories" : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              aria-label="Refresh products"
              disabled={loading}
              onClick={() => setRevision((n) => n + 1)}
            >
              <RefreshCw className={loading ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>
        {filtered && (
          <div className="filter-summary">
            <span>Filtered catalog</span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setDebouncedSearch("");
                setStatus("All");
                setCategory("All");
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
            >
              <X />
              Clear filters
            </Button>
          </div>
        )}
        {error ? (
          <div role="alert" className="table-error">
            <AlertCircle size={28} />
            <h3>Catalog is temporarily unavailable</h3>
            <p>{error}</p>
            <Button variant="outline" onClick={() => setRevision((n) => n + 1)}>
              Try again
            </Button>
          </div>
        ) : (
          <div aria-busy={loading} className="table-scroll">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((group) => (
                  <TableRow key={group.id}>
                    {group.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        aria-sort={
                          header.column.getCanSort()
                            ? header.column.getIsSorted() === "asc"
                              ? "ascending"
                              : header.column.getIsSorted() === "desc"
                                ? "descending"
                                : "none"
                            : undefined
                        }
                      >
                        {header.column.getCanSort() ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="sort-button"
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {header.column.getIsSorted() === "asc" ? (
                              <ArrowUp size={13} />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ArrowDown size={13} />
                            ) : (
                              <ArrowUpDown size={13} />
                            )}
                          </Button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: pagination.pageSize }, (_, i) => (
                    <TableRow key={i}>
                      {columns.map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton
                            className={j === 1 ? "h-10 w-40" : "h-5 w-16"}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() ? "selected" : undefined}
                      data-testid="product-row"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length}>
                      <div className="empty-state">
                        <Search size={28} />
                        <h3>No products found</h3>
                        <p>Try a different search or clear your filters.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="table-pagination">
          <p>
            {Object.keys(selection).length
              ? `${Object.keys(selection).length} selected · `
              : ""}
            {data?.rowCount
              ? `${pagination.pageIndex * pagination.pageSize + 1}–${Math.min((pagination.pageIndex + 1) * pagination.pageSize, data.rowCount)} of ${data.rowCount} products`
              : "0 products"}
          </p>
          <div className="pagination-controls">
            <div className="page-size-control">
              <span id="catalog-page-size-label">Rows per page</span>
              <Select
                value={String(pagination.pageSize)}
                disabled={loading}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger
                  aria-labelledby="catalog-page-size-label"
                  size="sm"
                  className="page-size-select"
                >
                  <SelectValue>{pagination.pageSize}</SelectValue>
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  {[8, 16, 32].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span>
              Page {pagination.pageIndex + 1} of{" "}
              {Math.max(1, table.getPageCount())}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="First page"
              disabled={loading || !!error || !table.getCanPreviousPage()}
              onClick={() => table.firstPage()}
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous page"
              disabled={loading || !!error || !table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next page"
              disabled={loading || !!error || !table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Last page"
              disabled={loading || !!error || !table.getCanNextPage()}
              onClick={() => table.lastPage()}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
      <div className="catalog-footer">
        <span>
          <span className="footer-dot" />
          Your catalog, up to date.
        </span>
        <span>
          Made for a more organized day <ArrowUpRight size={12} />
        </span>
      </div>
      <details className="connection-details">
        <summary>Connection details</summary>
        <code data-testid="server-info">
          {data
            ? `catalog · PID ${data.server.pid} · ${data.server.time}`
            : "Waiting for catalog backend"}
        </code>
        <p>
          Remote component → server function → catalog backend. Only the
          component is federated.
        </p>
      </details>
    </section>
  );
}

// The component owns data loading in SSR and in the browser. The host never imports a server function.
const ServerPanel = Object.assign(ServerPanelView, {
  preload: () => listProducts({ data: initialQuery }),
});
export default ServerPanel;
