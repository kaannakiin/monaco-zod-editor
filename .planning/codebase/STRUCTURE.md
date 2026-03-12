# Codebase Structure

**Analysis Date:** 2026-03-12

## Directory Layout

```
zod-monaco/
├── .planning/                      # GSD analysis outputs
├── packages/                       # Shared library packages
│   ├── core/                       # Core intelligence (zero dependencies)
│   ├── monaco/                     # Monaco editor adapter
│   ├── react/                      # React component wrapper
│   ├── vue/                        # Vue component wrapper
│   ├── angular/                    # Angular service wrapper
│   ├── typescript-config/          # Shared TypeScript configuration
│   └── eslint-config/              # Shared ESLint configuration
├── apps/
│   └── web/                        # Next.js demo application
├── package.json                    # Monorepo root package (private, pnpm workspace)
├── pnpm-workspace.yaml             # Workspace definition
├── turbo.json                       # Turborepo task orchestration
├── ARCHITECTURE.md                 # Product and technical architecture overview
├── MONACO_ZOD_ROADMAP.md           # Detailed feature roadmap and vision
└── README.md                       # Getting started guide
```

## Directory Purposes

**packages/core:**
- Purpose: Framework-agnostic Zod schema intelligence engine
- Contains: Type definitions, schema registry, suggestion/hover/diagnostic providers
- Key files: `src/index.ts` (301 lines, all core logic in one file)
- Build: TypeScript → ES2022 via tsc, outputs to `dist/index.js` and `dist/index.d.ts`

**packages/monaco:**
- Purpose: Monaco editor adapter and controller
- Contains: Monaco type interfaces, language registration, completion/hover provider wiring, editor controller
- Key files: `src/index.ts` (530 lines, includes MonacoApi types and DefaultZodEditorController)
- Build: TypeScript → ES2022 via tsc
- Exports: `registerZodMonacoLanguage()`, `createZodEditorController()`, all type interfaces

**packages/react:**
- Purpose: React component for Zod editor
- Contains: React hook setup, component lifecycle, props API
- Key files: `src/index.tsx` (111 lines, functional component using useRef and useEffect)
- Build: TypeScript → ES2022 via tsc
- Exports: `ZodMonacoEditor` component (div-based, HTML attributes passthrough)

**packages/vue:**
- Purpose: Vue 3 service/controller for Zod editor
- Contains: Wrapper factory adapting editor controller to Vue idioms
- Key files: `src/index.ts` (42 lines, factory function only, no components)
- Build: TypeScript → ES2022 via tsc
- Exports: `createZodMonacoVueController()` (not a Vue component, just a controller factory)

**packages/angular:**
- Purpose: Angular service controller implementing ControlValueAccessor
- Contains: Wrapper factory adapting editor controller to Angular form patterns
- Key files: `src/index.ts` (60 lines, factory function with form binding support)
- Build: TypeScript → ES2022 via tsc
- Exports: `createZodMonacoAngularController()` (factory, not a directive/component)

**packages/typescript-config:**
- Purpose: Shared TypeScript compiler settings for all packages
- Contains: Base config (ES2022, strict mode, declaration maps), Next.js config, React library config
- Key files: `base.json` (strict=true, moduleDetection=force, noUncheckedIndexedAccess=true)
- All packages extend `base.json` in their local `tsconfig.json`

**packages/eslint-config:**
- Purpose: Shared ESLint rules and configurations
- Contains: Base ESLint setup, Next.js plugin config, React internal config
- Exports: Exported as `./base`, `./next-js`, `./react-internal` for different package types

**apps/web:**
- Purpose: Next.js demo application showcasing editor integration
- Contains: Next.js app directory structure (layout.tsx, page.tsx)
- Key files: `app/page.tsx` (currently minimal placeholder)
- Dependencies: `next`, `react`, `react-dom`, `@zod-monaco/core`, `@zod-monaco/react` (and @repo aliases)
- Current state: Incomplete — ready for demo development once core is stable

## Key File Locations

**Entry Points:**
- Core intelligence: `packages/core/src/index.ts` — export all types, `SchemaRegistry` class, `createZodIntelligence()` factory
- Monaco adapter: `packages/monaco/src/index.ts` — export all Monaco types, `registerZodMonacoLanguage()`, `createZodEditorController()`
- React wrapper: `packages/react/src/index.tsx` — export `ZodMonacoEditor` component
- Vue wrapper: `packages/vue/src/index.ts` — export `createZodMonacoVueController()` factory
- Angular wrapper: `packages/angular/src/index.ts` — export `createZodMonacoAngularController()` factory

**Configuration:**
- Root workspace: `pnpm-workspace.yaml` — defines `apps/*` and `packages/*` glob patterns
- Turborepo: `turbo.json` — task definitions (build, lint, check-types, dev) with caching and output specs
- Root package manifest: `package.json` — defines scripts (build, dev, lint, format, check-types), devDependencies (prettier, turbo, typescript)
- TypeScript base: `packages/typescript-config/base.json` — inherits JSON schema, sets compiler options (strict, moduleDetection=force, target=ES2022)

**Core Logic:**
- Intelligence factory: `packages/core/src/index.ts`, line 149 (`createZodIntelligence()`)
- Schema registry: `packages/core/src/index.ts`, line 123 (`SchemaRegistry` class)
- Suggestion generation: `packages/core/src/index.ts`, line 157 (`getSuggestions()` method)
- Bracket diagnostics: `packages/core/src/index.ts`, line 252 (`getDiagnostics()` method)
- Hover analysis: `packages/core/src/index.ts`, line 205 (`getHover()` method)
- Monaco language registration: `packages/monaco/src/index.ts`, line 321 (`registerZodMonacoLanguage()`)
- Editor controller: `packages/monaco/src/index.ts`, line 402 (class `DefaultZodEditorController`)
- React component: `packages/react/src/index.tsx`, line 38 (function `ZodMonacoEditor`)

**Type Definitions:**
- Core types: `packages/core/src/index.ts`, lines 1–61 (ZodSuggestion, ZodHover, ZodDiagnostic, ZodCompletionContext, ZodIntelligence, etc.)
- Monaco types: `packages/monaco/src/index.ts`, lines 1–131 (MonacoApi, MonacoEditorApi, MonacoLanguagesApi, MonacoModelLike, etc.)
- React types: `packages/react/src/index.tsx`, lines 19–36 (ZodMonacoEditorProps interface)

## Naming Conventions

**Files:**
- Entry point: Always `index.ts` or `index.tsx` (single export file per package)
- Configuration: camelCase with full descriptors (`tsconfig.json`, `eslint.config.mjs`, `next.config.js`)
- Test files: Not yet present in codebase; recommend `*.test.ts` or `*.spec.ts` co-located with source

**Directories:**
- Package names: kebab-case in filesystem (`core/`, `monaco/`, `react/`, `vue/`, `angular/`), scoped npm names (`@zod-monaco/core`, `@repo/eslint-config`)
- Source: Always `src/` directory at package root
- Build output: Always `dist/` directory, added to `.gitignore`
- Distribution: List only `dist` in `files` array of `package.json`

**Functions and Types:**
- Factory functions: Prefixed `create` or `register` (`createZodIntelligence`, `registerZodMonacoLanguage`)
- Interface names: PascalCase, often with suffix for clarity (`ZodIntelligence`, `ZodSuggestion`, `MonacoApi`, `MonacoEditorChangeEvent`)
- Type helpers: Prefixed `to` or describe transformation (`toCompletionKind`, `toSeverity`, `toMarkers`, `toHover`)
- Private fields in classes: Use `#` prefix per ES2022 (`#schemas`, `#editor`, `#listeners`)

**Variables:**
- Constants: UPPERCASE_SNAKE_CASE (`DEFAULT_KEYWORDS`, `BRACKET_PAIRS`, `DEFAULT_LANGUAGE_ID`, `DEFAULT_MARKER_OWNER`)
- Mutable: camelCase (`suggestions`, `diagnostics`, `stack`)
- Abbreviations: Clear (use `element` not `el`, use `handler` not `fn`)

## Where to Add New Code

**New Feature in Core Intelligence:**
- File location: `packages/core/src/index.ts`
- Add type interface near top (lines 1–61)
- Add implementation in `createZodIntelligence()` factory return object (lines 149–300)
- Implement pure text analysis functions (similar to `getTokenAtOffset()`, `includesNeedle()`) at module level if reusable
- Export new type at top of file

**New Framework Wrapper (e.g., Svelte):**
- New package: `packages/svelte/` (mkdir, add package.json following `packages/react/package.json` pattern)
- Add `src/index.ts` with factory function
- Import and re-export from `@zod-monaco/monaco` and `@zod-monaco/core`
- Create minimal wrapper factory adapting `createZodEditorController()` to Svelte idioms
- Add to `pnpm-workspace.yaml` (glob already covers packages/*)

**New Provider (e.g., Signature Help):**
- Location: `packages/monaco/src/index.ts` in `createProviderDisposable()` function (line 252)
- Call `monaco.languages.registerSignatureHelpProvider()` alongside completion and hover
- Add type interface (e.g., `MonacoSignatureHelpResult`) near top with other Monaco types
- Implement mapping function (e.g., `toSignatureHelp()`) to convert core output to Monaco format

**Shared Configuration Update:**
- TypeScript: Edit `packages/typescript-config/base.json` or create new export (e.g., `strict.json`)
- ESLint: Edit `packages/eslint-config/base.js` or create new export
- Commit and all packages automatically pick up via `extends` or workspace references

**Demo App Content:**
- Location: `apps/web/app/page.tsx` or new route files under `apps/web/app/`
- Import `ZodMonacoEditor` from `@zod-monaco/react`
- Import `createZodIntelligence` from `@zod-monaco/core`
- Fetch Monaco from CDN or npm and pass to component
- Register sample schemas via `intelligence.registry.register()`

## Special Directories

**dist/ (Build Output):**
- Purpose: Compiled JavaScript and type definitions
- Generated: Yes, created by `tsc` during `pnpm build`
- Committed: No, listed in `.gitignore`
- Strategy: TypeScript → ES2022 modules, declaration maps enabled for IDE navigation

**.turbo/ (Cache):**
- Purpose: Turborepo local build cache
- Generated: Yes, created by Turborepo during task runs
- Committed: No, listed in `.gitignore`
- Strategy: Caching handled by `turbo.json` task definitions; inputs and outputs configured per task

**node_modules/ (Dependencies):**
- Purpose: Installed packages
- Generated: Yes, created by `pnpm install` using `pnpm-lock.yaml`
- Committed: No, listed in `.gitignore`
- Strategy: pnpm v9.0.0 with monorepo workspace linking (packages can depend on other packages via `workspace:*`)

**.pnpm-store/ (Package Store):**
- Purpose: pnpm's content-addressable storage
- Generated: Yes, created by pnpm
- Committed: No, configured in `.npmrc` as `shamefully-hoist=false` for workspace isolation
- Strategy: All packages linked from store, no duplication in node_modules

**.planning/ (GSD Artifacts):**
- Purpose: Automated codebase analysis documents
- Generated: Yes, by GSD mapping tools
- Committed: Yes (version-controlled planning docs)
- Contents: `ARCHITECTURE.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md`, `CONCERNS.md`, `STACK.md`, `INTEGRATIONS.md`
