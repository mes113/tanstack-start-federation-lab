# Contributing

Start with the [README](README.md), [development reference](docs/DEVELOPMENT.md),
[architecture](docs/ARCHITECTURE.md) and [test matrix](TESTING.md).

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
