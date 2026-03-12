# Codebase Concerns

**Analysis Date:** 2026-03-12

## Tech Debt

**Incomplete Project Initialization:**
- Issue: Repository created from Turborepo template with outdated placeholder documentation. README.md references `docs` app and `@repo/ui` package that do not exist or have been removed.
- Files: `/README.md`, `/apps/web/app/page.tsx`
- Impact: Misleading documentation makes onboarding difficult; developers cannot follow setup instructions as written. The actual packages (`@zod-monaco/core`, `@zod-monaco/monaco`, `@zod-monaco/react`, etc.) are not documented.
- Fix approach: Replace boilerplate README with actual project documentation. Align package names from `@repo/*` aliases to correct workspace packages. Update `package.json` script references.

**Empty Demo Application:**
- Issue: The web application at `apps/web/app/page.tsx` is a stub containing only a placeholder `<div>HomePage</div>`. The roadmap explicitly calls for "a polished web demo" and "a clean React demo app in `apps/web`" as critical deliverables for Phase 1 and Phase 4.
- Files: `apps/web/app/page.tsx`, `apps/web/app/layout.tsx`
- Impact: No usable demo of `@zod-monaco/react` component exists. End users and developers cannot test the library without building their own integration. Phase 0-4 roadmap cannot be validated against working prototype.
- Fix approach: Create functional demo page showing schema authoring with sample data validation. Integrate `ZodMonacoEditor` component from `@zod-monaco/react`. Add example schema registry and real-time validation output panel.

**No Testing Infrastructure:**
- Issue: No test framework configured. No test files exist in any package. All packages lack test scripts in `package.json`.
- Files: `packages/core/`, `packages/monaco/`, `packages/react/`, `packages/angular/`, `packages/vue/` (missing `*.test.ts` files and test configuration)
- Impact: Critical business logic in `@zod-monaco/core` (completions, hover, diagnostics) cannot be regression tested. Parser-dependent features from roadmap Phase 1+ (semantic diagnostics, signature help) cannot be validated. Breaking changes to API contract will not be caught. Angular and Vue controller implementations untested.
- Fix approach: Add Vitest or Jest. Create fixture-based tests for `createZodIntelligence()` with sample schemas and text inputs. Write unit tests for `SchemaRegistry`, `getTokenAtOffset()`, bracket diagnostics, and all suggestion types. Add integration tests for Monaco controller lifecycle.

## Known Bugs

**Hover Behavior on Underscore-Separated Tokens:**
- Symptoms: The token extraction regex in `getTokenAtOffset()` at `packages/core/src/index.ts:103` treats underscores as part of tokens, but the hover matching uses exact token equality. If a schema field contains underscores (e.g., `user_name`), the regex will capture `user_name` correctly, but hover is unlikely to trigger mid-identifier.
- Files: `packages/core/src/index.ts` (lines 102-103, 226-228)
- Trigger: Author a field name with underscore in schema. Hover over the middle of the field name in text.
- Workaround: Only hover over the start of tokens to activate hover.

**Missing Keyword Registration Check:**
- Symptoms: The `getHover()` function checks if a token is in `keywords` but does not verify the token was successfully matched before hover fires. For bare keywords not in the default list, no hover is returned.
- Files: `packages/core/src/index.ts` (lines 243-248)
- Trigger: Use a custom keyword via `options.keywords` that is not in `DEFAULT_KEYWORDS`. Hover will not show custom keyword documentation.
- Workaround: None. Custom keywords require workaround patches.

## Security Considerations

**No Input Validation on Schema Metadata:**
- Risk: The `RegisteredSchema` interface accepts arbitrary `description` and `examples` as strings without sanitization. If displayed in Monaco hover or completion items as Markdown without escaping, untrusted schema metadata could inject XSS payloads.
- Files: `packages/core/src/index.ts` (lines 9-22, 217-221), `packages/monaco/src/index.ts` (lines 239-249)
- Current mitigation: Monaco escapes `contents` by default in hover tooltips. But if a consuming app renders schema documentation in a custom UI, no sanitization is enforced.
- Recommendations: Document that schema metadata is user-provided and must be sanitized by consuming applications. Optionally add a `sanitize()` helper function. Mark `description` and `examples` as potentially unsafe.

**Registry Mutable After Registration:**
- Risk: The `RegisteredSchema` object is stored by reference in the registry. If a consuming app mutates the schema after registration, cached suggestions and hover docs will change unexpectedly without re-registration.
- Files: `packages/core/src/index.ts` (lines 124-147)
- Current mitigation: TypeScript `readonly` modifier on array fields in `RegisteredSchema`. Does not prevent mutations of nested objects.
- Recommendations: Add Object.freeze() to schemas on registration, or document that schemas must be immutable once registered.

## Performance Bottlenecks

**Diagnostics Run on Every Change:**
- Problem: `DefaultZodEditorController` calls `getDiagnostics()` on every keystroke via `onDidChangeModelContent()` listener (lines 444-446 in `packages/monaco/src/index.ts`). The bracket-matching diagnostics loop through entire text linearly (O(n) in `packages/core/src/index.ts` lines 256-295).
- Files: `packages/monaco/src/index.ts` (line 446), `packages/core/src/index.ts` (lines 252-298)
- Cause: No debouncing or incremental analysis. Schemas with hundreds or thousands of lines will stall editor responsiveness on every keystroke.
- Improvement path: Add configurable debounce option to `DefaultZodEditorController`. For Phase 2+, implement incremental diagnostics that reuse parse state instead of full re-scan. Consider worker-thread analysis for large schemas.

**Linear Search Through Schemas on Every Completion and Hover:**
- Problem: `getSuggestions()` and `getHover()` iterate through all registered schemas and their fields sequentially (lines 175-200 and 214-241 in `packages/core/src/index.ts`). With hundreds of fields across many schemas, every keystroke triggers O(m*n) string comparisons.
- Files: `packages/core/src/index.ts` (lines 175-200, 214-241)
- Cause: No indexing. String comparison via `includesNeedle()` is case-insensitive but not optimized.
- Improvement path: Build a trie or prefix index on registry schemas at construction time. Implement case-insensitive prefix matching with early termination. Cache keyword suggestions since keywords are static.

**No Lazy Loading for Large Schema Registries:**
- Problem: All schemas are loaded into `SchemaRegistry` memory at initialization. If a consuming app registers thousands of schemas, memory usage grows unbounded and lookup times degrade.
- Files: `packages/core/src/index.ts` (lines 123-147)
- Cause: Registry is a simple Map with no pagination, filtering, or lazy loading mechanism.
- Improvement path: Add optional `maxResults` parameter to `getSuggestions()`. Implement async registry support for Phase 2+. Add filtering by schema tags or category to reduce suggestion noise.

## Fragile Areas

**Bracket Diagnostic Logic is Fragile:**
- Files: `packages/core/src/index.ts` (lines 252-298)
- Why fragile: The bracket matching algorithm treats all open brackets equally and matches them in LIFO order. It does not distinguish between `(`, `[`, `{` until mismatch time. Adding new syntax (e.g., `<` for generics in Phase 2 parser work) requires careful state management. Quoted strings are not handled—brackets inside strings are incorrectly diagnosed.
- Safe modification: Write comprehensive unit tests for bracket sequences first. Test nested, mismatched, and interleaved brackets. Before extending diagnostics, build a real tokenizer that respects string boundaries.
- Test coverage: Only happy-path bracket matching is implicitly tested. String literals, escaped quotes, and nested depth limits not tested.

**MonacoApi Type Mocking is Incomplete:**
- Files: `packages/monaco/src/index.ts` (lines 11-131)
- Why fragile: The interface contracts `MonacoApi`, `MonacoModelLike`, `MonacoEditorApi`, etc. are hand-maintained type shims rather than generated from Monaco's actual API. If Monaco updates its API in a minor version (e.g., new editor option, new completion item property), the type definitions become stale without automatic detection.
- Safe modification: Add a test that instantiates the real Monaco editor and verifies that the mocked types accept actual Monaco objects. Document version pinning requirement for `monaco-editor` peer dependency.
- Test coverage: No integration tests verify that the adapter works with actual Monaco instances.

**React Component Cleanup Timing:**
- Files: `packages/react/src/index.tsx` (lines 66-92)
- Why fragile: The component's `useEffect` with dependency array `[editorOptions, intelligence, languageId, monaco, owner]` does not include `defaultValue`. If `defaultValue` prop changes after mount, the editor value does not update because the effect already ran. Conversely, the `value` effect (lines 94-100) only runs when `value` changes, not when editor options change. If editor options change, the editor is not recreated (which may be intentional but is brittle to assumptions).
- Safe modification: Add comprehensive Storybook or Chromatic tests showing mount/unmount cycles, prop updates, and edge cases (null/undefined editor, rapid prop changes). Document prop immutability expectations.
- Test coverage: No tests for React prop changes or lifecycle edge cases.

## Scaling Limits

**Single-File Core Implementation:**
- Current capacity: `packages/core/src/index.ts` is 301 lines. All intelligence (suggestions, hover, diagnostics) is in one file.
- Limit: As the roadmap progresses (Phase 1 snippets, Phase 2 semantic diagnostics, Phase 3 validation), this file will exceed 1000+ lines and become impossible to navigate.
- Scaling path: Refactor into separate modules: `registry.ts`, `completions.ts`, `hover.ts`, `diagnostics.ts`, `parser.ts` (Phase 2). Use barrel exports to maintain current API. Add clear module boundaries for future semantic analyzer work.

**Monolithic Monaco Controller:**
- Current capacity: `packages/monaco/src/index.ts` is 529 lines with controller, registration cache, provider factories, and type conversions mixed together.
- Limit: Adding new providers (signature help, code actions, formatting in Phase 2-3) will bloat this file. Refactoring becomes difficult.
- Scaling path: Extract provider factories into separate files. Move registration cache logic into a dedicated `RegistrationCache` class. Create `MonacoProviderFactory` abstraction for adding new providers without touching controller.

**No Version Pinning Strategy:**
- Current capacity: Peer dependencies are loose ranges (e.g., `"monaco-editor": "^0.52.0"`, `"zod": "^4.0.0"`). pnpm-lock.yaml pins exact versions, but consumers may resolve to different minor/patch versions.
- Limit: If Monaco 0.60 introduces breaking API changes, consuming apps with pinned `@zod-monaco` versions may fail silently. No safe upgrade path.
- Scaling path: Document tested Monaco versions and Zod versions. Consider exact versions in pnpm-lock or a compatibility matrix in documentation. Add CI tests against multiple Monaco versions.

## Dependencies at Risk

**Zod Peer Dependency Version Range:**
- Risk: Zod 4.x is pinned as peer dependency but the library does not actually use Zod in `@zod-monaco/core`. Zod is only referenced in TypeScript type hints (`TSchema = unknown` in `RegisteredSchema`). This is misleading and creates unnecessary coupling.
- Impact: Consuming apps must install Zod even if they only use the Monaco integration without schema validation.
- Migration plan: Either remove `zod` as peer dependency (since it's not used) or document that it's for type inference support in consuming apps. Clarify that the core library works with any schema object shape.

**monaco-editor Peer Dependency Critical:**
- Risk: `monaco-editor` is a large (>10MB) peer dependency required by both `@zod-monaco/monaco` and `@zod-monaco/react`. No tree-shaking guide provided. Consuming apps may accidentally bundle entire Monaco twice if not careful with imports.
- Impact: Bundle size bloat. Cold load time regression for web consumers.
- Migration plan: Add explicit re-export guards in `@zod-monaco/react` to ensure `monaco-editor` is imported once. Document bundler configuration for code splitting. Consider a separate `@zod-monaco/react-minimal` package that assumes Monaco is loaded globally (e.g., for CDN use).

**Missing Dependency: `@types/react` Mismatch:**
- Risk: `@zod-monaco/react` declares `peerDependency` on `react: ^19.0.0` but `devDependency` on `@types/react: 19.2.2` (older than React 19.2.0 devDependency in web app). This can cause type mismatches in consuming apps.
- Impact: Type errors in consuming projects. Consumers must manually upgrade `@types/react` to compatible version.
- Migration plan: Sync `@types/react` version with declared React peer dependency. Use `npm-check-updates` or Renovate to keep types aligned during release cycles.

## Missing Critical Features

**No Parser or AST:**
- Problem: The entire intelligence layer (completions, diagnostics, signature help) relies on regex-based text matching. There is no structured understanding of Zod schema syntax.
- Blocks: Cannot reliably suggest method context (e.g., suggest `min()` only after `z.string().`). Cannot detect invalid method chains or semantic errors. Cannot support snippet expansion with smart placeholder insertion.
- Fix needed: Phase 0 of roadmap requires defining a parser target (custom DSL or TypeScript subset) and building a minimal tokenizer/parser. This is blocking Phase 1 and Phase 2 completions/diagnostics.

**No Signature Help:**
- Problem: Users typing `z.string().min(` see no parameter hints or type information. This is in the roadmap Phase 2 but not implemented.
- Blocks: Users must consult external documentation. Reduces discoverability advantage over plain text editor.
- Fix needed: Add `signatureHelpProvider` registration to Monaco controller. Build signature metadata in registry. Implement in Phase 2.

**No Code Actions / Quick Fixes:**
- Problem: When diagnostics flag an error (e.g., mismatched bracket), no fix suggestion is offered.
- Blocks: Users must manually fix errors rather than one-click resolution. Roadmap Phase 3 feature not implemented.
- Fix needed: Implement `codeActionProvider` registration. Add fix strategies for bracket mismatches, unknown methods, and common typos. Implement in Phase 3.

**No Sample Data Validation UI:**
- Problem: The roadmap highlights "validate JSON input against the current schema" and "show parsed output / issues panel" as core Phase 3 workflow features. The demo app has no validation pane.
- Blocks: The strongest unique value of Monaco + Zod (side-by-side authoring and validation) is not demonstrated.
- Fix needed: Add validation sidebar to demo app. Connect to Zod at runtime. Show validation errors mapped back to schema line/column. Critical for Phase 3 but also needed for Phase 1 demo.

## Test Coverage Gaps

**No Fixture Tests for `createZodIntelligence()`:**
- What's not tested: Core intelligence functions (getSuggestions, getHover, getDiagnostics) with realistic schema inputs.
- Files: `packages/core/src/index.ts`
- Risk: Completing Phase 1 semantic diagnostics or Phase 2 parser work without existing test fixtures means regressions will not be caught. Any refactor of `createZodIntelligence()` is high-risk.
- Priority: **High** — This is the core of the product. Must have test coverage before Phase 1.

**No Registry Tests:**
- What's not tested: Schema registration, lookup, field searching, deduplication, performance with large registries.
- Files: `packages/core/src/index.ts` lines 123-147
- Risk: Registry API design decisions cannot be validated against scale. Unknown if registry lookup is O(1) or O(n). Bugs in field matching will not surface until scale.
- Priority: **High** — Critical data structure.

**No Monaco Controller Integration Tests:**
- What's not tested: End-to-end controller mount/unmount, editor value sync, diagnostics marker updates, listener registration/disposal.
- Files: `packages/monaco/src/index.ts` lines 402-529
- Risk: Memory leaks or dangling listeners cannot be detected. Switching between schemas or intelligence instances untested. Rapid mount/dispose cycles not validated.
- Priority: **Medium** — Can be tested with Vitest mocking, but real Monaco integration tests would be higher confidence.

**No React Component Tests:**
- What's not tested: Prop changes (value, defaultValue, onChange, onMount), cleanup, re-renders, integration with controller lifecycle.
- Files: `packages/react/src/index.tsx`
- Risk: Prop drilling errors, stale closures in effect dependencies, memory leaks from missing cleanup.
- Priority: **Medium** — Common React pitfalls can be caught with unit tests.

**No Framework Integration Tests for Angular and Vue:**
- What's not tested: `createZodMonacoAngularController` ControlValueAccessor behavior, Vue reactivity integration, event listener cleanup.
- Files: `packages/angular/src/index.ts`, `packages/vue/src/index.ts`
- Risk: Framework-specific binding patterns may break silently. Untested touched/blur state in Angular. Untested v-model in Vue.
- Priority: **Medium-Low** — Framework adapters are thin wrappers, but real integration tests would catch edge cases.

---

*Concerns audit: 2026-03-12*
