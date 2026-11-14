import { readFile, stat } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const marker = "<!-- federation-lab-unit-coverage -->";
const metrics = ["lines", "statements", "functions", "branches"];

export function formatCoverageComment(report, run, repository) {
  if (
    !/^[\w.-]+\/[\w.-]+$/.test(repository) ||
    !/^[a-f0-9]{40}$/.test(run.head_sha) ||
    !Number.isSafeInteger(run.id) ||
    run.id <= 0
  )
    throw new Error("Invalid workflow identity");
  const url = `https://github.com/${repository}/actions/runs/${run.id}`;
  const rows =
    report === null
      ? []
      : metrics.map((metric) => {
          const value = report?.total?.[metric];
          if (
            !value ||
            !Number.isSafeInteger(value.total) ||
            !Number.isSafeInteger(value.covered) ||
            value.total < 0 ||
            value.covered < 0 ||
            value.covered > value.total ||
            typeof value.pct !== "number" ||
            !Number.isFinite(value.pct) ||
            value.pct < 0 ||
            value.pct > 100 ||
            (value.total > 0 &&
              Math.abs(value.pct - (value.covered / value.total) * 100) > 0.02)
          )
            throw new Error(`Invalid coverage metric: ${metric}`);
          return `| ${metric[0].toUpperCase() + metric.slice(1)} | **${value.pct}%** | ${value.covered} / ${value.total} |`;
        });
  return [
    marker,
    "## Unit test coverage",
    "",
    `Commit: \`${run.head_sha.slice(0, 7)}\` · [CI run and full HTML/LCOV report](${url})`,
    "",
    run.conclusion === "success"
      ? "CI passed."
      : "CI did not pass. Check the linked run for failures or cancellation.",
    "",
    ...(report === null
      ? [
          "Coverage report unavailable for this commit. No percentage from an earlier commit is shown.",
        ]
      : [
          "| Metric | Coverage | Covered / Total |",
          "| --- | --- | --- |",
          ...rows,
        ]),
    "",
    "Unit coverage includes untested app and shared-package files, including vendored UI. Browser E2E and separate SSR/backend processes are not measured here.",
    "",
    "This comment is updated after each completed PR CI run. Download **unit-coverage** from the linked run for uncovered lines. Coverage is not a guarantee of correctness.",
  ].join("\n");
}

export async function publishCoverageComment({ event, report, request }) {
  const repository = event.repository.full_name;
  const run = await request(
    "GET",
    `/repos/${repository}/actions/runs/${event.workflow_run.id}`,
  );
  if (
    run.event !== "pull_request" ||
    run.status !== "completed" ||
    run.path !== ".github/workflows/ci.yml" ||
    run.repository.id !== event.repository.id
  )
    return "Skipped unrelated workflow";
  // PR identity always comes from GitHub, never from the downloaded artifact.
  const body = formatCoverageComment(report, run, repository);
  const candidates = await request(
    "GET",
    `/repos/${repository}/commits/${run.head_sha}/pulls?per_page=100`,
  );
  let published = 0;
  for (const candidate of candidates) {
    const path = `/repos/${repository}/pulls/${candidate.number}`;
    const pr = await request("GET", path);
    const current = (value) =>
      value.state === "open" &&
      value.base.repo.id === event.repository.id &&
      value.head.sha === run.head_sha &&
      value.head.ref === run.head_branch &&
      value.head.repo?.id === run.head_repository.id;
    if (!current(pr)) continue;
    let previous;
    for (let page = 1; !previous; page++) {
      const comments = await request(
        "GET",
        `/repos/${repository}/issues/${pr.number}/comments?per_page=100&page=${page}`,
      );
      previous = comments.find(
        (comment) =>
          comment.user?.login === "github-actions[bot]" &&
          comment.user.type === "Bot" &&
          comment.body?.startsWith(marker),
      );
      if (comments.length < 100) break;
    }
    // A push while the comments were loading must not overwrite a newer report.
    if (!current(await request("GET", path))) continue;
    if (previous)
      await request(
        "PATCH",
        `/repos/${repository}/issues/comments/${previous.id}`,
        { body },
      );
    else
      await request(
        "POST",
        `/repos/${repository}/issues/${pr.number}/comments`,
        { body },
      );
    published++;
  }
  return `Updated ${published} coverage comment(s)`;
}

async function main() {
  const event = JSON.parse(
    await readFile(process.env.GITHUB_EVENT_PATH, "utf8"),
  );
  let report = null;
  try {
    const info = await stat(process.env.COVERAGE_REPORT);
    if (!info.isFile() || info.size > 256_000)
      throw new Error("Invalid coverage report size");
    report = JSON.parse(await readFile(process.env.COVERAGE_REPORT, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const request = async (method, path, body) => {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.GH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(`GitHub API ${method} failed: ${response.status}`);
    return response.json();
  };
  console.log(await publishCoverageComment({ event, report, request }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
