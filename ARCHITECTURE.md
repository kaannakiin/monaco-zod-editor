# zod-monaco Architecture

## Current Shape

- `@zod-monaco/core`: Zod v4 → JSON Schema bridge with field-level metadata,
  schema traversal, and runtime validation.
- `@zod-monaco/monaco`: framework-agnostic Monaco controller with JSON Schema
  validation, Zod runtime diagnostics, hover tooltips, auto-completions,
  breadcrumb navigation, and `attachZodToEditor()` headless API for attaching
  Zod features to any existing editor instance. A shared schema registry
  allows multiple editors on the same Monaco namespace.
- `apps/web`: live JSON editor demo (Next.js)
- `apps/angular-web`: Angular demo

## Design Constraints

- JSON is the only editing surface.
- No custom Monaco language should be added.
- No framework wrapper packages — users integrate directly via
  `attachZodToEditor()` or `createZodEditorController()`.
- Metadata should travel separately from the base schema.
- Compatibility with removed legacy helpers is not a goal.
