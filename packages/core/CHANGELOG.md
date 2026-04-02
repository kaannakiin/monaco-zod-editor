# @zod-monaco/core

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

## 3.2.0

### Minor Changes

- 95386a7: Version alignment release to keep `@zod-monaco/core` and `@zod-monaco/monaco` in sync while publishing the Monaco worker bridge integration. No runtime changes in `core`.

## 3.1.0

### Minor Changes

- 116c428: fix: typed path segments, deduplicate syntax markers, merge diagnostics options
  - **Path segment typing (Bulgu 1):** Parser now returns `number` for array indices and `string` for object keys. Removes blind `/^\d+$/ → Number()` coercion from hover, completions, attach, and breadcrumb. Fixes incorrect read-only, hover, and completion behavior for numeric-looking object keys like `{"0": "val"}`.
  - **Deduplicate syntax markers (Bulgu 2):** Removed custom parse error marker — syntax errors are now handled solely by Monaco's built-in JSON validator. `ValidationResult.parseError` is still populated for listeners.
  - **Merge diagnostics options (Bulgu 3):** Added `setBaseOptions()` to `ZodSchemaRegistry` and `diagnosticsOptions` to `AttachZodOptions` / `CreateZodEditorControllerOptions`. Consumer settings like `allowComments` and `trailingCommas` are no longer overwritten on schema flush.
  - **Test coverage (Bulgu 4):** Added 6 typed segment tests covering numeric-looking object keys, mixed nesting, deep structures, and range queries.

## 3.0.0

### Major Changes

- **BREAKING: dot-notation ve `_meta` nested metadata formatı kaldırıldı.**

  `metadata.fields` artık yalnızca `FieldMetadataEntry[]` flat listesi kabul ediyor. Eski dot-notation record formatı ve `_meta` tree formatı artık çalışmıyor.

  ```ts
  // Önce — dot-notation record
  metadata: { fields: { "Children.Content": { title: "Content" } } }

  // Şimdi — segment array entry list
  metadata: {
    fields: [{ path: ["Children", "Content"], title: "Content" }]
  }
  ```

  **BREAKING: segment-array path modeli zorunlu hale geldi.**

  Tüm public path girdileri artık `readonly string[]` segment array formatında olmalı. Dot-notation string path desteği kaldırıldı.

  **Yeni `refinements` API eklendi.**

  `describeSchema()` artık `refinements` seçeneğini kabul ediyor. Enum refinements JSON Schema'ya inject edilir ve `descriptor.validate()` tarafından da runtime'da kontrol edilir.

  ```ts
  // Önce — dynamic enum için schema factory rebuild
  const descriptor = describeSchema(buildSchema(loopSources), { metadata });

  // Şimdi — sabit schema, runtime injection
  const descriptor = describeSchema(schema, {
    metadata,
    refinements: [{ path: ["Children", "Loop", "source"], enum: loopSources }],
  });
  ```

  **Yeni export'lar:** `SchemaPath`, `EnumRefinement`, `SuggestionRefinement`, `FieldMetadataEntry`, `applyEnumRefinements`, `matchesSchemaPath`

## 2.2.0

### Minor Changes

- 6845165: Add type-safe field metadata paths with `DeepPaths<T>` — full IDE autocomplete for `describeSchema` metadata fields up to 10 levels deep. Also adds optional nested object format with `_meta` sentinel as an alternative to flat dot-notation keys.

### Patch Changes

- 6845165: Fix hover resolution for allOf/intersection types and render default values in hover tooltips.

## 1.0.0

### Major Changes

- added-theme
