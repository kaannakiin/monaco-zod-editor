# Testing Patterns

**Analysis Date:** 2026-03-13

## Current State

- Vitest exists only in `packages/core`.
- The current test suite is intentionally tiny and guards the reset by ensuring
  deleted legacy exports stay deleted.
- Repo-wide confidence currently comes more from `pnpm check-types` than from
  runtime tests.

## Next Testing Priorities

- `packages/core`
  - Zod v4 schema input normalization
  - JSON Schema generation
  - Metadata/examples normalization
  - Runtime validation behavior
- `packages/monaco`
  - Controller lifecycle
  - Value sync
  - Marker mapping once diagnostics exist
- `packages/react`
  - Mount/unmount behavior
  - Controlled vs uncontrolled value flow
  - Validation callbacks once exposed

## Recommended Direction

- Keep tests colocated with source.
- Prefer explicit assertions over snapshots.
- Add feature tests only when the corresponding runtime behavior exists.
