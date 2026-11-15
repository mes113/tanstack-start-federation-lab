import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const metrics = ["lines", "statements", "functions", "branches"];
export function validateTotal(total) {
  for (const key of metrics) {
    const value = total?.[key];
    if (
      !value ||
      !Number.isSafeInteger(value.total) ||
      !Number.isSafeInteger(value.covered) ||
      value.total < 0 ||
      value.covered < 0 ||
      value.covered > value.total ||
      !Number.isFinite(value.pct) ||
      value.pct < 0 ||
      value.pct > 100 ||
      (value.total > 0 &&
        Math.abs(value.pct - (value.covered / value.total) * 100) > 0.02)
    )
      throw new Error(`Invalid coverage metric: ${key}`);
  }
  return total;
}
export function addedLines(diff) {
  const lines = new Set();
  for (const match of diff.matchAll(
    /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm,
  )) {
    const start = Number(match[1]),
      count = match[2] === undefined ? 1 : Number(match[2]);
    for (let index = 0; index < count; index++) lines.add(start + index);
  }
  return lines;
}
export function parseLcov(text, root = process.cwd()) {
  const files = new Map();
  let current;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      const name = relative(root, resolve(root, line.slice(3))).replaceAll(
        "\\",
        "/",
      );
      if (name.startsWith("../"))
        throw new Error("Coverage file outside workspace");
      current = files.get(name) ?? new Map();
      files.set(name, current);
    } else if (line.startsWith("DA:") && current) {
      const [position, hits] = line.slice(3).split(",").map(Number);
      if (
        !Number.isSafeInteger(position) ||
        position < 1 ||
        !Number.isSafeInteger(hits) ||
        hits < 0
      )
        throw new Error("Invalid LCOV line");
      current.set(position, Math.max(current.get(position) ?? 0, hits));
    } else if (line === "end_of_record") current = undefined;
  }
  return files;
}
export function changedCoverage(changes, coverage) {
  let total = 0,
    covered = 0,
    unmeasuredFiles = 0;
  for (const [file, added] of changes) {
    const measured = coverage.get(file);
    if (!measured) {
      unmeasuredFiles++;
      continue;
    }
    for (const line of added)
      if (measured.has(line)) {
        total++;
        if (measured.get(line) > 0) covered++;
      }
  }
  return { covered, total, unmeasuredFiles };
}
export function comparisonMarkdown(comparison) {
  if (!comparison) return "No base comparison is available for this run.";
  if (
    !/^[a-f0-9]{40}$/.test(comparison.baseSha) ||
    !/^[a-f0-9]{40}$/.test(comparison.testedSha)
  )
    throw new Error("Invalid comparison identity");
  validateTotal(comparison.head);
  if (comparison.base !== null) validateTotal(comparison.base);
  const { covered, total, unmeasuredFiles } = comparison.changed;
  if (
    ![covered, total, unmeasuredFiles].every(Number.isSafeInteger) ||
    covered < 0 ||
    total < covered ||
    unmeasuredFiles < 0
  )
    throw new Error("Invalid changed-line coverage");
  return [
    `Base: \`${comparison.baseSha.slice(0, 7)}\` · tested tree: \`${comparison.testedSha.slice(0, 7)}\``,
    "",
    ...(comparison.base === null
      ? ["Base coverage unavailable; no percentage delta is claimed."]
      : [
          "| Metric | Base | Tested tree | Change (percentage points) |",
          "| --- | --- | --- | --- |",
          ...metrics.map((key) => {
            const delta = comparison.head[key].pct - comparison.base[key].pct;
            return `| ${key} | ${comparison.base[key].pct}% | ${comparison.head[key].pct}% | ${delta > 0 ? "+" : ""}${delta.toFixed(2)} |`;
          }),
        ]),
    "",
    total
      ? `Changed executable lines: **${((covered / total) * 100).toFixed(2)}%** (${covered}/${total}).`
      : "No changed executable lines were measured by this unit suite.",
    `${unmeasuredFiles} changed source file(s) are outside the unit report. Non-executable lines are excluded. Integration executions are not counted.`,
  ].join("\n");
}
async function main() {
  const baseSha = process.env.BASE_SHA;
  if (!/^[a-f0-9]{40}$/.test(baseSha ?? ""))
    throw new Error("BASE_SHA must be the exact PR base commit");
  const git = (...args) =>
    execFileSync("git", args, { encoding: "utf8", windowsHide: true });
  const testedSha = git("rev-parse", "HEAD").trim();
  const files = git(
    "diff",
    "--name-only",
    "--diff-filter=AM",
    "--no-renames",
    "-z",
    baseSha,
    "HEAD",
    "--",
    "apps",
    "packages",
  )
    .split("\0")
    .filter(
      (file) =>
        /\.(?:ts|tsx|mjs)$/.test(file) &&
        !file.endsWith(".d.ts") &&
        !file.endsWith("/routeTree.gen.ts"),
    );
  const changes = new Map(
    files.map((file) => [
      file,
      addedLines(
        git(
          "diff",
          "--no-ext-diff",
          "--unified=0",
          "--no-renames",
          baseSha,
          "HEAD",
          "--",
          file,
        ),
      ),
    ]),
  );
  const head = validateTotal(
    JSON.parse(await readFile("coverage/coverage-summary.json", "utf8")).total,
  );
  let base = null;
  if (process.env.BASELINE_VALID !== "false")
    try {
      base = validateTotal(
        JSON.parse(
          await readFile(
            "coverage-base/coverage/coverage-summary.json",
            "utf8",
          ),
        ).total,
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  const changed = changedCoverage(
    changes,
    parseLcov(await readFile("coverage/lcov.info", "utf8")),
  );
  const comparison = { baseSha, testedSha, head, base, changed };
  comparisonMarkdown(comparison);
  await writeFile(
    "coverage/comparison.json",
    JSON.stringify(comparison, null, 2),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
