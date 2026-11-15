# Shared shadcn/ui primitives

Private React-only workspace used by the host, catalog, orders and plain React
warehouse. Import primitives through `@lab/ui/button`, `@lab/ui/input`,
`@lab/ui/checkbox`, `@lab/ui/tabs`, `@lab/ui/select`, `@lab/ui/card`,
`@lab/ui/badge`, `@lab/ui/table` and `@lab/ui/skeleton`.

These are editable shadcn registry components, with the original notice preserved
in [LICENSE.shadcn](../../LICENSE.shadcn). Keep application logic, routes, server
functions and TanStack Start dependencies out of this package. The common
[theme](../../apps/theme.css) scans the package; standalone apps must compile and
include that theme too. All applications use the same pinned React version.

Host/catalog UI compatibility paths re-export these components. This workspace is
consumed at build time; it is not a federated remote or an npm-published library.
