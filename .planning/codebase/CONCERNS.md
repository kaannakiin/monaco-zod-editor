# Codebase Concerns

**Analysis Date:** 2026-03-13

## Primary Risks

- `@zod-monaco/core` is intentionally empty, so the real product value is not
  implemented yet.
- `@zod-monaco/monaco` currently handles lifecycle only; there is no schema
  registration or validation plumbing.
- The web app is not a demo and should not be mistaken for one.

## Immediate Engineering Concerns

- The next implementation pass must define the Zod v4 schema-first API before
  adding wrappers or UI polish.
- Metadata shape is still a product decision; the repo only locks in that it
  should remain separate from the first runtime schema input.
- Framework wrappers may drift unless they are rebuilt only after the core API
  stabilizes.

## Testing Concerns

- Current test coverage is minimal by design after the reset.
- The first real feature work should add focused tests in `core` before Monaco
  wiring expands.
