# @zod-monaco/monaco

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
