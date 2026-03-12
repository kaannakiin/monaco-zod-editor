# Zod Monaco

## What This Is

A Zod integration library for Monaco editor that provides a full IDE experience for editing JSON data validated by Zod schemas. Users provide a Zod v4 schema, the library extracts JSON Schema via Zod's built-in `toJSONSchema()` API and feeds it to Monaco's JSON language service — getting validation, completions, and hover for free. On top, Zod's runtime APIs (safeParse) provide real validation with errors mapped to Monaco markers. Rich metadata via custom Zod methods (e.g., `.meta()`) powers enhanced hover content. Published as scoped npm packages (`@zod-monaco/*`) in a Turborepo monorepo.

## Core Value

When a developer passes a Zod schema to the editor component, they get a full IDE experience — completions, hover documentation, and real-time diagnostics — with zero configuration beyond the schema itself.

## Requirements

### Validated

- ✓ Monorepo scaffold with core, monaco, react, vue, angular packages — existing
- ✓ Core intelligence layer with suggestions, hover, and bracket diagnostics — existing
- ✓ Monaco adapter with provider registration, controller, and marker wiring — existing
- ✓ React wrapper component (`ZodMonacoEditor`) — existing
- ✓ Vue and Angular controller factories — existing
- ✓ Shared TypeScript and ESLint configs — existing

### Active

- [ ] Zod v4 → JSON Schema conversion via built-in `toJSONSchema()` API
- [ ] Monaco JSON language service configuration with generated JSON Schema
- [ ] Zod runtime validation (safeParse) with configurable triggers (onChange debounced, onBlur, manual)
- [ ] Zod diagnostic → Monaco marker mapping for runtime validation errors
- [ ] z.describe() metadata extraction and hover display
- [ ] Custom Zod method extensions (e.g., `.meta({ title, placeholder })`) for rich metadata
- [ ] Enhanced hover content powered by Zod metadata
- [ ] Full IDE experience: completions, hover, diagnostics, custom actions all working together
- [ ] Framework wrappers (React, Vue, Angular) updated for JSON mode integration

### Out of Scope

- Custom Zod DSL language mode — using Monaco's built-in JSON mode instead
- Server-side validation — this is a client-side editor library
- Schema editor (editing Zod code) — this edits JSON data that conforms to a Zod schema
- Real-time collaboration — single-user editor experience
- Mobile support — Monaco doesn't support mobile browsers

## Context

- **Zod v4**: The project targets Zod v4 exclusively, which includes a built-in `toJSONSchema()` API — no external converter needed.
- **Two-layer validation strategy**: Monaco's JSON language service handles structural validation (completions, basic type checking) via JSON Schema, while Zod's `safeParse` handles runtime validation with richer error messages.
- **Existing scaffold**: The monorepo structure, core intelligence engine, Monaco adapter, and framework wrappers are already scaffolded with working bracket diagnostics, keyword suggestions, and schema registry. The JSON mode integration and Zod runtime connection are the missing pieces.
- **Monaco JSON mode**: Instead of a custom language, the editor uses Monaco's built-in JSON language with Zod-derived JSON Schema fed to `monaco.languages.json.jsonDefaults.setDiagnosticsOptions()`.

## Constraints

- **Zod v4 only**: No backward compatibility with Zod v3 — leverages v4's built-in JSON Schema support
- **Peer dependencies**: monaco-editor ^0.52.0 and zod ^4.0.0 are peer deps, not bundled
- **Synchronous core**: All core analysis operations must remain synchronous (no workers/promises) for responsive keystroke handling
- **Tree-shakeable**: Published packages must support tree-shaking for minimal bundle impact
- **TypeScript 5.9+**: Strict mode, declaration maps for IDE support

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Monaco JSON mode + Zod JSON Schema | Free completions/validation from Monaco's JSON language service; Zod runtime adds richer errors | — Pending |
| Zod v4 only (no v3 support) | v4 has built-in toJSONSchema(), cleaner API, simpler codebase | — Pending |
| Custom Zod methods for metadata | `.meta()` extension gives type-safe metadata that flows through to hover/completions | — Pending |
| Configurable validation triggers | Different use cases need different timing: forms want onChange, configs want onBlur | — Pending |
| Scoped npm packages (@zod-monaco/*) | Clear namespace, professional publishing, consistent with ecosystem conventions | — Pending |

---
*Last updated: 2026-03-12 after initialization*
