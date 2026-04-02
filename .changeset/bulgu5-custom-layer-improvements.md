---
"@zod-monaco/core": minor
"@zod-monaco/monaco": minor
---

feat: breadcrumb metadata enrichment, field constraints, read-only violation UX, worker bridge, catalog-powered cache

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
