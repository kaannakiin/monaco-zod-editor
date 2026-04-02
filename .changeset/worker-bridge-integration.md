---
"@zod-monaco/core": minor
"@zod-monaco/monaco": minor
---

feat: JSON worker bridge integration for schema-aware hover and completions

- Added `WorkerBridge` — cached, timeout-guarded access to Monaco's JSON language service worker via `json.getWorker()`
- Hover provider now async: enriches tooltips with `MatchingSchema` branch info for `oneOf`/`anyOf`/`allOf` schemas
- Completion provider now async: uses worker's schema branch detection for accurate union enum suggestions
- Added `setModeConfiguration()` call to disable Monaco's built-in hover/completions when custom providers are active
- Validation pipeline uses worker AST for marker positioning when available
- New `disableWorker` option on `AttachZodOptions` and `CreateZodEditorControllerOptions`
- Graceful fallback: if worker is unavailable (CORS, CDN), all features continue working via sync custom parser
- New types exported: `WorkerBridge`, `MonacoJsonWorker`, `MonacoJsonDocument`, `MonacoJsonNode`, `MonacoMatchingSchema`, `MonacoJsonModeConfiguration`
