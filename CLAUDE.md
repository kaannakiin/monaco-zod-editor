# zod-monaco Agent Brief

## Product Truth

- Monaco is used for editing JSON documents only.
- Zod v4 lives behind the editor and drives validation, JSON Schema generation,
  and metadata-aware UX.
- Monaco's built-in JSON mode is the only planned editing mode.
- Metadata should be passed through a separate library-level input during the
  first implementation wave.

## Hard Constraints

- Do not introduce a custom Monaco language for Zod code.
- Do not rebuild removed legacy intelligence helpers.
- Do not preserve compatibility with the deleted custom-language API surface.
- Keep the package split, but treat it as a fresh start:
  - `@zod-monaco/core`: Zod v4 runtime and JSON Schema bridge
  - `@zod-monaco/monaco`: Monaco JSON adapter and marker wiring
  - `@zod-monaco/react`: first framework wrapper

## Working Rules

- If documentation and code disagree, fix the documentation drift before adding
  new features.
- Prefer deleting misleading scaffolding over keeping placeholders that imply
  unsupported behavior.
- The web app should stay honest: no fake demo that suggests implemented JSON
  validation if the runtime path is not wired yet.
