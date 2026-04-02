# @zod-monaco/monaco

## 3.3.0

### Minor Changes

- 545580a: feat: breadcrumb metadata enrichment, field constraints, read-only violation UX, worker bridge, catalog-powered cache
  - **Breadcrumb metadata:** `BreadcrumbSegment` now includes optional `title`, `readOnly`, `description` from schema metadata
  - **Breadcrumb label cache:** `buildBreadcrumbLabelCache()` pre-computes labels from field catalog for O(1) cursor tracking
  - **Field constraints:** `FieldMetadata.constraints` auto-populated from JSON Schema (min/max, pattern, length, items, default)
  - **Constraint display:** Hover tooltips show validation constraints; completion items include constraint hints
  - **Read-only violation UX:** `onReadOnlyViolation` callback now receives `ReadOnlyViolationDetail` with `path` and `operation` (type/paste/delete/replace)
  - **Worker bridge:** JSON language service worker integration for schema-aware hover/completion (`getWorker` + `MatchingSchema`)
  - **Mode configuration:** `setModeConfiguration()` disables built-in JSON hover/completions when custom providers are active
  - **Locale fields:** `schemaBranch` and `constraints` added as optional fields to `ZodMonacoLocale`
  - **New exports:** `FieldConstraints`, `ReadOnlyViolationDetail`, `BreadcrumbLabelCache`, `buildBreadcrumbLabelCache`, `WorkerBridge`, `MonacoJsonWorker`, `MonacoJsonDocument`, `MonacoJsonNode`, `MonacoMatchingSchema`, `MonacoJsonModeConfiguration`

  ### Breaking change

  `onReadOnlyViolation` callback now receives `ReadOnlyViolationDetail` object (`{ path, operation }`) instead of plain `FieldPath`. Update: `detail.path` to access the field path.

### Patch Changes

- Updated dependencies [545580a]
  - @zod-monaco/core@3.3.0

## 3.2.0

### Minor Changes

- 95386a7: feat: JSON worker bridge integration for schema-aware hover and completions
  - Added `WorkerBridge` — cached, timeout-guarded access to Monaco's JSON language service worker via `json.getWorker()`
  - Hover provider now async: enriches tooltips with `MatchingSchema` branch info for `oneOf`/`anyOf`/`allOf` schemas
  - Completion provider now async: uses worker's schema branch detection for accurate union enum suggestions
  - Added `setModeConfiguration()` call to disable Monaco's built-in hover/completions when custom providers are active
  - Validation pipeline uses worker AST for marker positioning when available
  - New `disableWorker` option on `AttachZodOptions` and `CreateZodEditorControllerOptions`
  - Graceful fallback: if worker is unavailable (CORS, CDN), all features continue working via sync custom parser
  - New types exported: `WorkerBridge`, `MonacoJsonWorker`, `MonacoJsonDocument`, `MonacoJsonNode`, `MonacoMatchingSchema`, `MonacoJsonModeConfiguration`

### Patch Changes

- Updated dependencies [95386a7]
  - @zod-monaco/core@3.2.0

## 3.1.0

### Minor Changes

- 116c428: fix: typed path segments, deduplicate syntax markers, merge diagnostics options
  - **Path segment typing (Bulgu 1):** Parser now returns `number` for array indices and `string` for object keys. Removes blind `/^\d+$/ → Number()` coercion from hover, completions, attach, and breadcrumb. Fixes incorrect read-only, hover, and completion behavior for numeric-looking object keys like `{"0": "val"}`.
  - **Deduplicate syntax markers (Bulgu 2):** Removed custom parse error marker — syntax errors are now handled solely by Monaco's built-in JSON validator. `ValidationResult.parseError` is still populated for listeners.
  - **Merge diagnostics options (Bulgu 3):** Added `setBaseOptions()` to `ZodSchemaRegistry` and `diagnosticsOptions` to `AttachZodOptions` / `CreateZodEditorControllerOptions`. Consumer settings like `allowComments` and `trailingCommas` are no longer overwritten on schema flush.
  - **Test coverage (Bulgu 4):** Added 6 typed segment tests covering numeric-looking object keys, mixed nesting, deep structures, and range queries.

### Patch Changes

- Updated dependencies [116c428]
  - @zod-monaco/core@3.1.0

## 3.0.0

### Major Changes

- **`refinements` desteği eklendi.**

  `attachZodToEditor` ve `createZodEditorController` artık `refinements` seçeneğini kabul ediyor. `SuggestionRefinement` ile free-text alanlara runtime completion inject edilebiliyor.

  ```ts
  attachZodToEditor({
    monaco,
    editor,
    descriptor,
    refinements: [
      {
        path: ["Children", "Content"],
        suggestions: ["{Name}", "{Price}", "{Category}"],
        triggerPattern: "\\{",
      },
    ],
  });
  ```

  **`setRefinements()` eklendi.**

  `ZodEditorAttachment` ve `ZodEditorController` üzerinden suggestion refinements runtime'da güncellenebiliyor — editor yeniden mount edilmeden.

  **Completion önceliği:** JSON Schema enum değerleri her zaman önce gelir. Suggestion refinements yalnızca o path'te enum yoksa gösterilir.

  **BREAKING:** Bu release `@zod-monaco/core`'daki breaking değişikliklerle birlikte geliyor — path girdilerinin segment-array formatına geçirilmesi gerekiyor.

### Patch Changes

- Updated dependencies
  - @zod-monaco/core@3.0.0

## 2.2.0

### Patch Changes

- 6845165: Fix hover resolution for allOf/intersection types and render default values in hover tooltips.
- Updated dependencies [6845165]
- Updated dependencies [6845165]
  - @zod-monaco/core@2.2.0

## 2.1.2

### Patch Changes

- Fix `onValidationChange` listeners not being called on JSON parse errors and other early-return paths in `runValidation`/`scheduleValidation`. Previously, typing invalid JSON would silently clear markers without notifying listeners, leaving UI consumers with stale results. Parse errors now emit a `ValidationResult` with `valid: false` and a `parseError` message. The `ValidationResult` type gains an optional `parseError` field.

## 1.0.6

### Patch Changes

- Only set MonacoEnvironment.getWorker when not already configured; use fetch-then-blob worker to avoid cross-origin restrictions.

## 1.0.5

### Patch Changes

- Set MonacoEnvironment only when loading Monaco ourselves; use importScripts blob worker to avoid cross-origin Worker restrictions.

## 1.0.4

### Patch Changes

- Revert fetch-then-blob worker to direct Worker with type classic to fix worker loading.

## 1.0.2

### Patch Changes

- 8092569: Fix circular type dependency between index.ts and raw-types.ts by extracting base Monaco interfaces to a new monaco-types.ts leaf module. This resolves moduleResolution compatibility issues for consumers using "node" or "bundler" strategies.

## 1.0.1

### Patch Changes

- 50f30b8: Fix CORS error when loading Monaco workers from CDN by switching from getWorkerUrl to getWorker with blob proxy using importScripts(). Also handle cases where Monaco or AMD loader is already present on the page.

## 1.0.0

### Major Changes

- added-theme

### Patch Changes

- Updated dependencies
  - @zod-monaco/core@1.0.0
