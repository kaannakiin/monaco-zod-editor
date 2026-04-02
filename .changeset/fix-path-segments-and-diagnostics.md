---
"@zod-monaco/core": minor
"@zod-monaco/monaco": minor
---

fix: typed path segments, deduplicate syntax markers, merge diagnostics options

- **Path segment typing (Bulgu 1):** Parser now returns `number` for array indices and `string` for object keys. Removes blind `/^\d+$/ → Number()` coercion from hover, completions, attach, and breadcrumb. Fixes incorrect read-only, hover, and completion behavior for numeric-looking object keys like `{"0": "val"}`.
- **Deduplicate syntax markers (Bulgu 2):** Removed custom parse error marker — syntax errors are now handled solely by Monaco's built-in JSON validator. `ValidationResult.parseError` is still populated for listeners.
- **Merge diagnostics options (Bulgu 3):** Added `setBaseOptions()` to `ZodSchemaRegistry` and `diagnosticsOptions` to `AttachZodOptions` / `CreateZodEditorControllerOptions`. Consumer settings like `allowComments` and `trailingCommas` are no longer overwritten on schema flush.
- **Test coverage (Bulgu 4):** Added 6 typed segment tests covering numeric-looking object keys, mixed nesting, deep structures, and range queries.
