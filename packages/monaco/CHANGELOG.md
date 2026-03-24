# @zod-monaco/monaco

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
