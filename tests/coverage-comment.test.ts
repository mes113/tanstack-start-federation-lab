import { describe, expect, rs, test } from "@rstest/core";
import {
  formatCoverageComment,
  marker,
  publishCoverageComment,
} from "../scripts/coverage-comment.mjs";

const event = {
  repository: { id: 1, full_name: "owner/lab" },
  workflow_run: { id: 42 },
};
const run = {
  id: 42,
  head_sha: "a".repeat(40),
  event: "pull_request",
  status: "completed",
  conclusion: "success",
  path: ".github/workflows/ci.yml",
  repository: { id: 1 },
  head_repository: { id: 2 },
  head_branch: "feature",
  pull_requests: [], // GitHub can omit this association for fork PRs.
};
const pr = {
  number: 13,
  state: "open",
  base: { repo: { id: 1 }, sha: "b".repeat(40) },
  head: { sha: run.head_sha, ref: "feature", repo: { id: 2 } },
};
const metric = { total: 10, covered: 8, pct: 80 };
const report = {
  total: {
    lines: metric,
    statements: metric,
    functions: metric,
    branches: metric,
  },
};
const botComment = {
  id: 99,
  body: `${marker}\nold report`,
  user: { type: "Bot", login: "github-actions[bot]" },
};
function client({
  workflow = run,
  pull = pr,
  latest = pull,
  comments = [] as (typeof botComment)[],
  firstPage = comments,
} = {}) {
  let reads = 0;
  return rs.fn(async (method: string, path: string, _body?: unknown) => {
    if (method !== "GET") return {};
    if (path.includes("/actions/runs/")) return workflow;
    if (path.includes("/commits/")) return [{ number: pr.number }];
    if (path.includes("/pulls/")) return reads++ === 0 ? pull : latest;
    if (path.includes("/comments?"))
      return path.endsWith("page=1") ? firstPage : comments;
    throw new Error(`Unexpected request: ${path}`);
  });
}
function writes(request: ReturnType<typeof client>) {
  return request.mock.calls.filter(([method]) => method !== "GET");
}

describe("coverage PR comment", () => {
  test("only publishes comparison for the current base commit from GitHub", async () => {
    const comparison = {
      baseSha: pr.base.sha,
      testedSha: run.head_sha,
      head: report.total,
      base: report.total,
      changed: { covered: 3, total: 4, unmeasuredFiles: 0 },
    };
    const request = client();
    await publishCoverageComment({ event, report, request, comparison });
    expect(JSON.stringify(writes(request))).toContain("75.00%");
    const stale = client();
    await publishCoverageComment({
      event,
      report,
      request: stale,
      comparison: { ...comparison, baseSha: "c".repeat(40) },
    });
    expect(JSON.stringify(writes(stale))).not.toContain("75.00%");
  });
  test("formats percentages, counts, commit and canonical report link", () => {
    const body = formatCoverageComment(report, run, "owner/lab");
    expect(body).toContain("| Lines | **80%** | 8 / 10 |");
    expect(body).toContain("`aaaaaaa`");
    expect(body).toContain("https://github.com/owner/lab/actions/runs/42");
    expect(body).toContain("SSR/backend processes are not measured");
  });
  test.each([
    undefined,
    { ...metric, pct: "@someone" },
    { ...metric, pct: Infinity },
    { ...metric, pct: -1 },
    { ...metric, pct: 101 },
    { ...metric, pct: 90 },
    { ...metric, covered: 11 },
    { ...metric, total: -1 },
  ])("rejects invalid artifact numbers %#", (value) => {
    expect(() =>
      formatCoverageComment(
        { total: { ...report.total, lines: value } },
        run,
        "owner/lab",
      ),
    ).toThrow("Invalid coverage metric");
  });
  test("reports unavailable coverage instead of reusing old percentages", () => {
    const body = formatCoverageComment(
      null,
      { ...run, conclusion: "failure" },
      "owner/lab",
    );
    expect(body).toContain("Coverage report unavailable");
    expect(body).toContain("CI did not pass");
    expect(body).not.toContain("80%");
  });
  test("finds fork PR through GitHub even with an empty run association", async () => {
    const request = client();
    await publishCoverageComment({
      event,
      report: { ...report, pr: 999 },
      request,
    });
    expect(writes(request)).toHaveLength(1);
    expect(writes(request)[0][1]).toBe("/repos/owner/lab/issues/13/comments");
  });
  test("updates the existing bot comment instead of adding another", async () => {
    const request = client({ comments: [botComment] });
    await publishCoverageComment({ event, report, request });
    expect(writes(request)[0].slice(0, 2)).toEqual([
      "PATCH",
      "/repos/owner/lab/issues/comments/99",
    ]);
  });
  test("does not edit a contributor's copied marker", async () => {
    const request = client({
      comments: [
        { ...botComment, user: { type: "User", login: "contributor" } },
      ],
    });
    await publishCoverageComment({ event, report, request });
    expect(writes(request)[0][0]).toBe("POST");
  });
  test.each([
    { ...pr, state: "closed" },
    { ...pr, head: { ...pr.head, sha: "b".repeat(40) } },
    { ...pr, head: { ...pr.head, repo: { id: 3 } } },
    { ...pr, base: { repo: { id: 3 } } },
  ])("skips closed, stale or unrelated PRs %#", async (pull) => {
    const request = client({ pull });
    await publishCoverageComment({ event, report, request });
    expect(writes(request)).toHaveLength(0);
  });
  test("does not overwrite coverage when a push arrives during publication", async () => {
    const request = client({
      latest: { ...pr, head: { ...pr.head, sha: "b".repeat(40) } },
    });
    await publishCoverageComment({ event, report, request });
    expect(writes(request)).toHaveLength(0);
  });
  test.each([
    { ...run, event: "push" },
    { ...run, path: ".github/workflows/other.yml" },
    { ...run, repository: { id: 3 } },
  ])("ignores unrelated workflow runs %#", async (workflow) => {
    const request = client({ workflow });
    await publishCoverageComment({ event, report, request });
    expect(writes(request)).toHaveLength(0);
  });
  test("finds an existing comment beyond the first page", async () => {
    const request = client({
      firstPage: Array.from({ length: 100 }, () => ({
        ...botComment,
        body: "Unrelated comment",
      })),
      comments: [botComment],
    });
    await publishCoverageComment({ event, report, request });
    expect(writes(request)[0][0]).toBe("PATCH");
  });
});
