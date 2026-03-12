# Coding Conventions

**Analysis Date:** 2026-03-12

## Naming Patterns

**Files:**
- TypeScript source files: `index.ts` for main module exports, descriptive names for utilities
- Configuration files: `eslint.config.js`, `tsconfig.json`, `tsconfig.check.json`
- No special file naming conventions beyond lowercase with hyphens for multi-word files

**Functions:**
- camelCase for function names: `normalizeNeedle()`, `includesNeedle()`, `getTokenAtOffset()`, `createZodIntelligence()`
- Verb-first naming for actions: `create`, `register`, `get`, `set`, `provide`, `mount`
- Private functions marked with `#` prefix in classes: `#updateDiagnostics()`, `#schemas`
- Factory functions prefixed with `create`: `createZodIntelligence()`, `createZodEditorController()`, `createProviderDisposable()`

**Variables:**
- camelCase for regular variables: `suggestions`, `diagnostics`, `containerRef`, `controllerRef`
- Constants in UPPER_CASE: `DEFAULT_KEYWORDS`, `DEFAULT_LANGUAGE_ID`, `DEFAULT_MARKER_OWNER`, `BRACKET_PAIRS`
- Ref suffixes for React refs: `containerRef`, `controllerRef`, `initialValueRef`, `onChangeRef`, `onMountRef`
- Private properties with `#` prefix: `#schemas`, `#listeners`, `#editor`, `#language`, `#monaco`, `#intelligence`

**Types:**
- PascalCase for interfaces and types: `ZodIntelligence`, `RegisteredSchema`, `SchemaFieldMetadata`, `ZodDiagnostic`
- Type suffix for type-only definitions: `ZodSuggestionKind`, `ZodDiagnosticSeverity`
- Descriptive, full names: `MonacoStandaloneEditorLike`, `CreateZodEditorControllerOptions`, `ZodEditorController`

## Code Style

**Formatting:**
- Tool: Prettier 3.7.4
- Configuration: Shared across monorepo, applied via `prettier --write "**/*.{ts,tsx,md}"`
- Line length: Appears to follow Prettier defaults (no explicit config found)
- Semicolons: Always present
- Quotes: Double quotes for strings

**Linting:**
- Tool: ESLint 9.39.1 with TypeScript support
- Configuration: Flat config format (eslint.config.js)
- Base config: `packages/eslint-config/base.js` - shared across all packages
- React packages use: `packages/eslint-config/react-internal.js`
- Key plugins:
  - TypeScript ESLint: `typescript-eslint`
  - Turbo: `eslint-plugin-turbo`
  - React Hook Rules: `eslint-plugin-react-hooks`
  - ESLint Plugin React: `eslint-plugin-react`
- Only Warnings: `eslint-plugin-only-warn` used (violations are warnings, not errors)

**Key ESLint Rules:**
- TypeScript strict mode recommended rules enabled
- React hooks rules enabled: `react-hooks/rules-of-hooks`
- React scope not needed: `react/react-in-jsx-scope` OFF (uses new JSX transform)
- Prettier integration: `eslint-config-prettier` disables conflicting rules

## Import Organization

**Order:**
1. React and framework imports (React, Vue, Angular types as needed)
2. External packages (type definitions, utilities)
3. Internal monorepo packages (using `@zod-monaco/*`, `@repo/*`)
4. Relative imports (same package utilities)

**Path Aliases:**
- Workspace dependencies: `@zod-monaco/core`, `@zod-monaco/monaco`, `@zod-monaco/react`
- Shared configs: `@repo/eslint-config`, `@repo/typescript-config`

**Example:**
```typescript
import {
  createZodEditorController,
  type CreateZodEditorControllerOptions,
  type MonacoDisposable,
  type ZodEditorController,
} from "@zod-monaco/monaco";

export * from "@zod-monaco/core";
export * from "@zod-monaco/monaco";
```

## Error Handling

**Patterns:**
- Error thrown as `Error` with descriptive message:
  ```typescript
  throw new Error(
    `Language "${languageId}" is already registered with a different intelligence instance.`,
  );
  ```
- Defensive null checks: `?.` optional chaining and `?? ""` nullish coalescing
- Early returns for null/undefined: `if (!tokenRange) { return null; }`
- Default values in destructuring and function parameters

**Validation:**
- Math.max/Math.min for boundary checks: `Math.max(0, Math.min(offset, text.length))`
- Type guards: `character in BRACKET_PAIRS`, `typeof` checks
- Safe array access with nullish coalescing: `text[start - 1] ?? ""`

## Logging

**Framework:** console (browser/runtime native console, no logging framework)

**Patterns:**
- No logging found in source code
- Diagnostic messages returned as structured data (ZodDiagnostic objects) rather than logged

## Comments

**When to Comment:**
- JSDoc comments on exported interfaces and functions
- Inline comments rare; code is self-documenting
- Type annotations serve as documentation

**JSDoc/TSDoc:**
- Used on exported public APIs: `@type`, `@param`, `@returns` tags
- Example from eslint-config:
  ```typescript
  /**
   * A shared ESLint configuration for the repository.
   *
   * @type {import("eslint").Linter.Config[]}
   * */
  ```

## Function Design

**Size:** Small, focused functions (10-50 lines typical)
- Examples:
  - `normalizeNeedle()`: 3 lines
  - `getTokenAtOffset()`: 20 lines
  - `includesNeedle()`: 5 lines
  - `toCompletionKind()`: 8 lines

**Parameters:**
- Options objects for multiple parameters: `CreateZodEditorControllerOptions`, `CreateZodIntelligenceOptions`
- Type-safe option interfaces with optional fields
- No positional parameters beyond 2-3

**Return Values:**
- Explicit return types always specified
- Return null for "not found" scenarios: `getTokenAtOffset(): TextRange | null`
- Return objects for multiple values: `{ start, end }`
- Return readonly arrays for immutable data: `readonly ZodDiagnostic[]`

## Module Design

**Exports:**
- Named exports for types and functions
- Re-export pattern for API composition:
  ```typescript
  export * from "@zod-monaco/core";
  export * from "@zod-monaco/monaco";
  ```
- Default exports for config files only

**Barrel Files:**
- All packages use `index.ts` as barrel export file
- No subdirectory barrel files; flat package structure

**Private Implementation:**
- Classes use `#` private fields for encapsulation
- Example `DefaultZodEditorController` class implements public interface `ZodEditorController`
- Private class properties: `#editor`, `#monaco`, `#intelligence`, `#listeners`

## Type Safety

**Strict TypeScript:**
- Compiler options in `packages/typescript-config/base.json`:
  - `strict: true`
  - `declaration: true` (output .d.ts files)
  - `declarationMap: true` (source map for types)
  - `noUncheckedIndexedAccess: true`
  - `isolatedModules: true`

**Generics:**
- Used sparingly: `RegisteredSchema<TSchema = unknown>`, `Map<string, RegisteredSchema>`
- Defaults provided for type parameters

**Union Types:**
- Discriminated unions: `ZodSuggestionKind = "schema" | "field" | "keyword"`
- Switch statements for exhaustive handling

---

*Convention analysis: 2026-03-12*
