# @zod-monaco/monaco

## 1.0.1

### Patch Changes

- 50f30b8: Fix CORS error when loading Monaco workers from CDN by switching from getWorkerUrl to getWorker with blob proxy using importScripts(). Also handle cases where Monaco or AMD loader is already present on the page.

## 1.0.0

### Major Changes

- added-theme

### Patch Changes

- Updated dependencies
  - @zod-monaco/core@1.0.0
