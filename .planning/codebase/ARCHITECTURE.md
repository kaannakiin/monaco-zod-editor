# Architecture

**Analysis Date:** 2026-03-12

## Pattern Overview

**Overall:** Layered monorepo with framework-agnostic core intelligence, Monaco-specific adapters, and framework-specific wrappers.

**Key Characteristics:**
- Core schema intelligence layer completely decoupled from Monaco and framework concerns
- Monaco package acts as a thin adapter translating core abstractions to Monaco APIs
- Framework wrappers (React, Vue, Angular) provide idiomatic APIs without duplicating logic
- Strong separation of concerns: intelligence (core), editor integration (monaco), UI framework bindings (react/vue/angular)
- Dependency graph flows strictly from framework → Monaco → core (no reverse dependencies)

## Layers

**Core Intelligence Layer (`@zod-monaco/core`):**
- Purpose: Analyze Zod schema text and provide suggestions, diagnostics, and hover content
- Location: `packages/core/src/index.ts`
- Contains: Type definitions for suggestions/diagnostics/hover, `SchemaRegistry` class, `createZodIntelligence()` factory
- Depends on: Nothing (zero external dependencies)
- Used by: `@zod-monaco/monaco`, all framework packages, apps
- Key abstractions: `ZodIntelligence` interface, `SchemaRegistry`, text analysis functions

**Monaco Adapter Layer (`@zod-monaco/monaco`):**
- Purpose: Register Zod language with Monaco editor, wire up providers, manage editor lifecycle
- Location: `packages/monaco/src/index.ts`
- Contains: Monaco-specific types (interfaces for `MonacoApi`, `MonacoModelLike`, etc.), editor controller, provider registration logic
- Depends on: `@zod-monaco/core`
- Used by: React, Vue, Angular wrappers
- Key abstraction: `ZodEditorController` for mounting, getting/setting values, and managing event listeners

**Framework Wrappers:**
- React (`@zod-monaco/react/src/index.tsx`): Wraps controller in useEffect hooks, manages ref lifecycle, exposes props-based API
- Vue (`@zod-monaco/vue/src/index.ts`): Wraps controller with Vue 3-specific methods (`getModelValue`, `setModelValue`, `onModelValueChange`)
- Angular (`@zod-monaco/angular/src/index.ts`): Wraps controller with ControlValueAccessor pattern (`readValue`, `writeValue`, `registerOnChange`)

**Configuration Layer:**
- TypeScript config: `packages/typescript-config/base.json` with strict mode, ES2022 target, declaration maps
- ESLint config: `packages/eslint-config/` with base, Next.js, and react-internal exports
- Turbo orchestration: `turbo.json` defines task dependencies (build depends on ^build, etc.)

**Demo App:**
- Location: `apps/web/` (Next.js 16)
- Currently minimal (placeholder `HomePage`)
- Intended to showcase editor integration once developed

## Data Flow

**Completion Flow:**

1. User types in Monaco editor
2. Monaco calls registered `CompletionItemProvider.provideCompletionItems(model, position)`
3. Provider extracts word at position via `model.getWordUntilPosition()`
4. Provider calls `intelligence.getSuggestions()` with text, offset, and word
5. Core analyzes text and returns sorted `ZodSuggestion[]` array
6. Provider maps suggestions to `MonacoCompletionItem[]` using `toCompletionKind()` helper
7. Monaco displays suggestions with proper kind icons and sort order

**Hover Flow:**

1. User hovers over token in editor
2. Monaco calls registered `HoverProvider.provideHover(model, position)`
3. Provider extracts full token via `model.getWordAtPosition()`
4. Provider calls `intelligence.getHover()` with text, offset, and word
5. Core returns `ZodHover` or null
6. Provider maps hover to `MonacoHoverResult` and sets range
7. Monaco displays hover popup

**Diagnostics Flow:**

1. Editor mounts or content changes
2. `DefaultZodEditorController` calls `#updateDiagnostics()`
3. Retrieves current text via `editor.getModel().getValue()`
4. Calls `intelligence.getDiagnostics(text)` to get bracket/syntax errors
5. Maps diagnostics to `MonacoMarkerData` using `toMarkers()` helper
6. Calls `monaco.editor.setModelMarkers()` to render inline error squiggles
7. Markers update on next keystroke

**State Management:**

- `SchemaRegistry`: Stateful map of schema names to `RegisteredSchema` objects, populated at initialization
- Editor value: Managed by `DefaultZodEditorController.#value` and synced to Monaco model
- Language registration: Cached per `MonacoApi` instance using `WeakMap<MonacoApi, Map<string, RegistrationState>>` to handle multiple editors
- Listeners: Tracked in `Set<(value, event) => void>` within controller
- Disposables: Each provider, language, and editor holds a disposable reference for cleanup

## Key Abstractions

**SchemaRegistry:**
- Purpose: Store and retrieve registered Zod schemas with metadata (name, fields, examples, descriptions)
- Examples: Used by completions to suggest schema names and field paths, by hover to show documentation
- Pattern: Simple Map-backed singleton, populated from `RegisteredSchema[]` at initialization

**ZodIntelligence:**
- Purpose: Core interface providing three analysis methods (getSuggestions, getHover, getDiagnostics)
- Implementation: Created by `createZodIntelligence()` factory, captures registry and keywords at creation time
- All text analysis is pure and stateless — same text always produces same suggestions/diagnostics

**ZodEditorController:**
- Purpose: Lifecycle manager for Monaco editor, separates text value, mount state, and event listeners
- Implementation: `DefaultZodEditorController` class with private fields for editor, disposables, listeners
- Enables multiple independent editors on same page with proper cleanup (dispose pattern)

**Text Analysis Functions (Core):**
- `getTokenAtOffset(text, offset)`: Finds word boundaries using regex `[A-Za-z0-9_.]`
- `normalizeNeedle(word)`: Lowercases and trims for case-insensitive matching
- `includesNeedle(value, needle)`: Partial matching for completion filtering

**Bracket Matching (Diagnostics):**
- `BRACKET_PAIRS`: Map of open/close bracket pairs
- Stack-based parser: pushes open brackets, validates on close, reports mismatches and unclosed brackets
- No semantic understanding yet (AST or tokenizer planned for Phase 1 of roadmap)

**Type Conversion Helpers (Monaco):**
- `toCompletionKind()`: Maps `ZodSuggestionKind` → Monaco `CompletionItemKind` (Class, Field, Keyword, Text)
- `toSeverity()`: Maps `ZodDiagnosticSeverity` → Monaco `MarkerSeverity` (Error, Warning, Info, Hint)
- `createRange()`: Converts text offsets to Monaco line/column ranges via `getPositionAt()`
- `toMarkers()`: Batch converts `ZodDiagnostic[]` → `MonacoMarkerData[]`
- `toHover()`: Converts `ZodHover` → `MonacoHoverResult` with range mapping

## Entry Points

**Core Factory:**
- Location: `packages/core/src/index.ts`, line 149
- Triggers: Called once per editor or integration to create intelligence instance
- Responsibilities: Initialize schema registry from options, return interface with three methods
- Parameters: Optional `CreateZodIntelligenceOptions` with schemas array and custom keywords

**Monaco Language Registration:**
- Location: `packages/monaco/src/index.ts`, line 321 (`registerZodMonacoLanguage`)
- Triggers: Called once per language ID (default "zod-schema"), cached by Monaco instance
- Responsibilities: Register language, wire up completion and hover providers, manage provider lifecycle with reference counting
- Implementation: Uses `registrationCache` WeakMap to deduplicate registrations, throws if same language ID registered with different intelligence

**Editor Controller Creation:**
- Location: `packages/monaco/src/index.ts`, line 525 (`createZodEditorController`)
- Triggers: Called once per editor instance
- Responsibilities: Create `DefaultZodEditorController`, configure diagnostics, set initial value
- Returns: `ZodEditorController` interface with mount, getValue, setValue, onChange, dispose methods

**React Component:**
- Location: `packages/react/src/index.tsx`, exported as `ZodMonacoEditor`
- Triggers: Rendered as React component in app
- Responsibilities: Manage container ref, instantiate controller, attach event listeners, handle prop changes
- Props: `monaco`, `intelligence`, `value`, `defaultValue`, `onChange`, `onMount`, `editorOptions`, etc.

**Framework-Specific Factories:**
- Angular: `packages/angular/src/index.ts`, line 24 (`createZodMonacoAngularController`)
- Vue: `packages/vue/src/index.ts`, line 22 (`createZodMonacoVueController`)
- Both create thin wrappers that adapt `ZodEditorController` to framework idioms

## Error Handling

**Strategy:** No error throws in analysis layer; graceful degradation on invalid input or missing data.

**Patterns:**

- **Missing token at offset:** `getTokenAtOffset()` returns null, completion and hover return empty or null gracefully
- **Invalid bracket:** Diagnostics collected and returned with error severity; unmatched brackets reported by code (`mismatched-bracket`, `unclosed-bracket`)
- **Unknown schema/keyword:** Silently skipped in suggestion filtering, no error thrown
- **Disposed controller:** Methods check for null `#editor` and bail out; calling dispose twice is safe
- **Language re-registration:** `registerZodMonacoLanguage()` throws only if same ID registered with different intelligence instance (error contract)

## Cross-Cutting Concerns

**Logging:** Not implemented yet. All functions are pure and return results; side effects are limited to Monaco marker updates and event listener calls.

**Validation:** Schema metadata validated at registry registration time (no validation yet); suggestions filtered by string matching (no semantic validation yet). Bracket diagnostics validate syntax only, not Zod method chain validity.

**Authentication:** Not applicable (no remote calls or auth needed).

**Async:** All operations synchronous on keystroke. No workers, promises, or async calls in core or monaco layers. Framework wrappers may wrap controller in async patterns (e.g., React useEffect for cleanup).
