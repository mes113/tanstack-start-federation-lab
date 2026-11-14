import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import styles from "../styles.css?url";
import { HandbookShell } from "../components/HandbookShell";
export const Route = createRootRoute({
  notFoundComponent: () => (
    <main className="standalone-content" data-testid="not-found-screen">
      <h1>Page not found</h1>
      <p>This topic or example does not exist.</p>
      <a href="/guide">Back to the overview</a>
    </main>
  ),
  head: () => ({
    links: [{ rel: "stylesheet", href: styles }],
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Federation Lab · Interactive developer guide" },
    ],
  }),
  component: () => (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <HandbookShell>
          <Outlet />
        </HandbookShell>
        <Scripts />
      </body>
    </html>
  ),
});
