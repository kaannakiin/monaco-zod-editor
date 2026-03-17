# Zod Monaco

## What This Is

A Turborepo workspace for a Monaco-based JSON editor backed by Zod v4. The
editor surface is JSON-only; Zod remains outside the editor and will power JSON
Schema generation, runtime validation, and metadata-aware UX.

## Core Value

Consumers should eventually be able to pass a Zod v4 schema into the library
and receive a JSON editing experience with completions, diagnostics, hover
content, and runtime validation grounded in that schema.

## Current State

- The repo has been reset to remove misleading legacy scaffolding.
- `@zod-monaco/core` is intentionally empty while the new schema-first runtime
  API is designed.
- `@zod-monaco/monaco` provides only editor lifecycle plumbing with JSON as the
  default language.
- Framework wrappers are thin adapters over that controller shell.
- `apps/web` is a status page until real JSON validation exists.

## Active Goals

- [ ] Define the schema-first public contract around Zod v4 input.
- [ ] Generate JSON Schema from Zod v4.
- [ ] Configure Monaco JSON diagnostics from the generated schema.
- [ ] Run Zod runtime validation against edited JSON.
- [ ] Add separate metadata/examples input for hover and richer UX.
- [ ] Rebuild the demo once the runtime path is real.

## Out of Scope

- Any editor mode where users type Zod code directly
- Backward compatibility with removed legacy helpers
- Server-side validation
- Realtime collaboration
- Mobile Monaco support
