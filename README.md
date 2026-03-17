# zod-monaco

`zod-monaco` is a Turborepo workspace for a Monaco-based JSON editor powered by
Zod v4.

## Product Direction

- Users edit JSON, not Zod code.
- Zod v4 stays behind the editor and will provide JSON Schema generation,
  runtime validation, and metadata-aware UX.
- Monaco should rely on its built-in JSON language service.
- Rich hover and example content should come from a separate metadata input.

## Current Status

This repository has been intentionally reset to remove misleading legacy
scaffolding. The remaining code is a clean starting point:

- `@zod-monaco/core` is an empty shell reserved for the upcoming Zod v4 bridge.
- `@zod-monaco/monaco` keeps a minimal Monaco controller with JSON as the
  default editor mode.
- `@zod-monaco/react`, `@zod-monaco/vue`, and `@zod-monaco/angular` remain thin
  wrappers around that controller shell.
- `apps/web` is a status page instead of a fake feature demo.

## Workspace Layout

- `apps/web`: lightweight product-status surface
- `packages/core`: future Zod v4 runtime integration point
- `packages/monaco`: Monaco controller shell
- `packages/react`: React wrapper
- `packages/vue`: Vue wrapper
- `packages/angular`: Angular wrapper
- `packages/typescript-config`: shared TypeScript config
- `packages/eslint-config`: shared ESLint config

## Commands

```sh
pnpm check-types
pnpm --filter @zod-monaco/core test
pnpm --filter web dev
```

## Near-Term Build Order

1. Implement `@zod-monaco/core` around Zod v4 schema input.
2. Wire Monaco JSON diagnostics and schema registration in
   `@zod-monaco/monaco`.
3. Rebuild the React wrapper around the new schema-first API.
4. Replace the status page with a real JSON editor demo only after the runtime
   path exists.
