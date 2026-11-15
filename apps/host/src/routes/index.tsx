import { ssrRemote } from "../components/ssr-remote";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { RemoteBoundary, RemoteError } from "../components/RemoteBoundary";
import { ChapterWorkbench } from "../components/ChapterWorkbench";
import { BoundaryFrame } from "../components/HandbookShell";
import { catalogChapter } from "../chapters";

const catalogRemote = ssrRemote(() => import("catalog/ServerPanel"));
const ServerPanel = catalogRemote.Component;

export const Route = createFileRoute("/")({
  loader: async () => {
    const remote = await catalogRemote.load().catch(() => null);
    const initialData = remote
      ? await remote.default.preload().catch(() => null)
      : null;
    return { initialData, available: !!remote };
  },
  component: Home,
});

function Home() {
  const { initialData, available } = Route.useLoaderData();
  return (
    <main className="handbook-page" id="demo-content">
      <ChapterWorkbench
        {...catalogChapter}
        observed={
          initialData
            ? `${initialData.rows.length} rows received from catalog; ${initialData.rowCount} products match the initial query.`
            : available
              ? "Catalog loaded, but its backend returned no data. The error below is the observed result."
              : "The catalog module could not be loaded. Start the remote and reload."
        }
      >
        <BoundaryFrame owner="Catalog">
          <RemoteBoundary name="Catalog">
            <Suspense
              fallback={
                <div className="route-loading">Loading the catalog…</div>
              }
            >
              {available ? (
                <ServerPanel title="Products" initialData={initialData} />
              ) : (
                <RemoteError
                  name="Catalog"
                  message="The catalog remote entry could not be loaded. Start the catalog app and reload."
                />
              )}
            </Suspense>
          </RemoteBoundary>
        </BoundaryFrame>
        <p className="chapter-example-footer">
          The host owns this page and its route loader. The catalog remote owns
          the table.{" "}
          <a href="http://127.0.0.1:3004" target="_blank" rel="noreferrer">
            Open standalone catalog ↗
          </a>
        </p>
      </ChapterWorkbench>
    </main>
  );
}
