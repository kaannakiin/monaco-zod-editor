# Architecture

**Analysis Date:** 2026-03-13

## Overview

The codebase is now a clean shell for a JSON-first Monaco + Zod product. The
legacy custom-language path has been removed, but the monorepo structure stays
intact so the real implementation can land in place.

## Layers

- `@zod-monaco/core`
  - Currently empty by design
  - Reserved for Zod v4 schema input, JSON Schema generation, metadata
    normalization, and runtime validation
- `@zod-monaco/monaco`
  - Minimal editor controller
  - Mounts Monaco with JSON as the default language
  - Owns editor lifecycle and value synchronization only
- Framework wrappers
  - React component plus Vue and Angular controller wrappers
  - Thin adapters over the Monaco controller
- `apps/web`
  - Static status surface that describes repo direction honestly

## Current Data Flow

1. A wrapper creates `createZodEditorController`.
2. The controller mounts Monaco with JSON as the default language.
3. Value changes flow from Monaco back through controller listeners.
4. No schema, metadata, or validation path is wired yet.

## Next Intended Data Flow

1. Consumer passes a Zod v4 schema plus optional metadata/examples input.
2. `core` converts the schema to JSON Schema and prepares runtime validation.
3. `monaco` registers Monaco JSON diagnostics with the generated schema.
4. Runtime Zod validation issues are mapped back to Monaco markers.
5. Wrappers expose parsed results and validation state without duplicating logic.
