# Contributing

Start with the [README](README.md), [development reference](docs/DEVELOPMENT.md),
[architecture](docs/ARCHITECTURE.md) and [test matrix](TESTING.md).

## Send a contribution

Fork the repository, create a topic branch in your fork and open a pull request against
main. You do not need collaborator or write access. Describe the change and its validation
using the PR template. Maintainers review external workflow runs before approving them;
that approval permits CI to run and is separate from approving the PR for merge.

Read [SECURITY.md](SECURITY.md) before reporting vulnerabilities and follow the
[community conduct policy](CODE_OF_CONDUCT.md). Never include real credentials or private data.

## Make a change

1. Install with `npm ci` and run the first `npm run build` before relying on generated remote types.
2. Make the change in the application that owns it. Keep remote server-function modules private; expose component modules and component-owned preloads.
3. Update the relevant handbook excerpt, expected result and documentation when behavior changes. Ownership labels describe code ownership, not live service health.
4. Rebuild declarations after changing a remote contract, then run typecheck and the relevant focused tests.

Use the repository's Rstest, Rslint and Prettier commands. The full validation commands
and required free ports are in [TESTING.md](TESTING.md). Do not run process-owned E2E
tests alongside the ordinary dev servers. Generated archives, build output, local test
reports and traces stay out of Git.

## Prepare a pull request

Explain the user-visible behavior and the host/remote boundary affected by the change.
Include the checks actually run, any intentional skips, and relevant SSR/browser coverage.
For UI changes, include a screenshot or a short reproduction path. Describe meaningful
limitations, such as in-memory persistence or compatibility requirements for deployment.

Keep local fixture identities, signing keys and fault controls clearly identified as demo
infrastructure. Preserve upstream license notices when adapting shared UI components.

## Required checks and maintainer review

The CI workflow runs lint/format checks and both production and development Rstest suites
on GitHub-hosted Linux runners. Each integration run generates remote declarations before
type checking. Its final CI gate fails if a required job fails, is cancelled or is skipped.

Main requires a PR, resolved review conversations and a successful, current CI check. Force
pushes and branch deletion are blocked. Code owners review contributions, and new commits
dismiss stale approvals. The owner has a PR-only exception from review requirements to
handle self-authored PRs; it does not bypass required CI or permit direct pushes to main.

Workflow actions are pinned by commit SHA, checkout credentials are not persisted, and
automatic package-manager caching is disabled for untrusted PR execution. Do not add
secrets, write permissions or self-hosted runners to PR jobs.
