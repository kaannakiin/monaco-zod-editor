# External Integrations

**Analysis Date:** 2026-03-13

## Current Integrations

- Monaco remains a peer dependency for the editor-facing packages.
- React, Vue, and Angular wrappers depend on their framework runtimes only.
- No external APIs, databases, or services are integrated.

## Current Runtime Flow

- `createZodEditorController` mounts Monaco with JSON as the default language.
- Wrappers subscribe to editor changes through controller callbacks.
- No schema registration or runtime validation integration is present yet.

## Next Integration Targets

- Zod v4 in `@zod-monaco/core`
- Monaco JSON diagnostics in `@zod-monaco/monaco`
- Validation result propagation through framework wrappers
