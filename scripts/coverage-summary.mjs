import { appendFile, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { comparisonMarkdown } from "./coverage-compare.mjs";
let comparison = null;
try {
  comparison = JSON.parse(await readFile("coverage/comparison.json", "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const report = JSON.parse(
  await readFile("coverage/coverage-summary.json", "utf8"),
);
const metrics = ["lines", "statements", "functions", "branches"];
function cells(entry) {
  return metrics.map((metric) => {
    const { covered, total, pct } = entry[metric];
    return `${pct}% (${covered}/${total})`;
  });
}
const rows = Object.entries(report)
  .filter(([file]) => file !== "total")
  .map(([file, entry]) => {
    const path = relative(process.cwd(), resolve(file)).replaceAll("\\", "/");
    if (isAbsolute(path) || path.startsWith("../"))
      throw new Error(`Coverage file is outside the workspace: ${path}`);
    return { path, entry };
  })
  .sort((a, b) => a.path.localeCompare(b.path));
const summary = [
  "## Unit test coverage",
  "",
  "Rstest + Istanbul. Includes all app and shared-package source files, including untested files; excludes generated route trees and declarations.",
  "",
  "Browser E2E and separate SSR/backend processes are tested by the integration jobs but are **not measured by this unit coverage report**. Vendored shadcn/ui components are included in the totals.",
  "",
  "| Scope | Lines | Statements | Functions | Branches |",
  "| --- | --- | --- | --- | --- |",
  `| **All source** | ${cells(report.total).join(" | ")} |`,
  "",
  comparisonMarkdown(comparison),
  "",
  "Minimum coverage is enforced for session handling, workspace mutations and the runtime contract guard. See `rstest.coverage.config.ts` for thresholds.",
  "",
  "Download the **unit-coverage** artifact from this run and open `index.html` for highlighted uncovered lines. `lcov.info` and `coverage-summary.json` are included for tooling.",
  "",
  "<details>",
  "<summary>Coverage by file</summary>",
  "",
  "| File | Lines | Statements | Functions | Branches |",
  "| --- | --- | --- | --- | --- |",
  ...rows.map(({ path, entry }) => {
    const safePath = path.replaceAll("`", "&#96;").replaceAll("|", "&#124;");
    return `| \`${safePath}\` | ${cells(entry).join(" | ")} |`;
  }),
  "",
  "</details>",
  "",
].join("\n");
process.stdout.write(summary);
if (process.env.GITHUB_STEP_SUMMARY)
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
