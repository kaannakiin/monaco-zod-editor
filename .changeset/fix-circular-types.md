---
"@zod-monaco/monaco": patch
---

Fix circular type dependency between index.ts and raw-types.ts by extracting base Monaco interfaces to a new monaco-types.ts leaf module. This resolves moduleResolution compatibility issues for consumers using "node" or "bundler" strategies.
