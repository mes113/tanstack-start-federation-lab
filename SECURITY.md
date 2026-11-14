# Security policy

## Report privately

Use [GitHub private vulnerability reporting](https://github.com/mes113/tanstack-start-federation-lab/security/advisories/new)
for vulnerabilities in this repository. Include the affected commit, prerequisites,
reproduction steps and potential impact. Do not post exploit details, tokens, cookies or
private data in public issues or pull requests. We will investigate and coordinate any fix;
there is no guaranteed response-time commitment or bounty program.

## Supported scope

The current main branch is maintained. This is a local reference app, not a production
authentication or deployment system. Alice/Bob selectors, the default signing key, fault
injection and in-memory notes are documented fixtures. Reports should distinguish these
intentional limitations from unintended session isolation, credential leakage, transport,
SSR or workflow security issues.

For vulnerabilities in upstream dependencies, report to the upstream project's security
channel as appropriate and include this repository's affected usage when relevant.

## External contributions and automation

External contributors use forks and pull requests; write access is not required. CI runs
untrusted PR code on ephemeral GitHub-hosted runners with read-only repository permissions,
no repository secrets, and no persisted checkout credentials. Maintainers must review code
before approving an external workflow run, including repeat contributors. Workflow changes,
installation hooks, dependency/lockfile changes and scripts deserve particular attention.

Do not execute an unfamiliar contributor branch on a workstation containing credentials.
Do not use a privileged pull_request_target or workflow_run job to execute PR code or
consume its artifacts as trusted release input. Dependency updates are reviewed PRs and
are not automatically merged.
