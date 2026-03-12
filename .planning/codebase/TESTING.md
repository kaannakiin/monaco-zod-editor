# Testing Patterns

**Analysis Date:** 2026-03-12

## Test Framework

**Status:** No tests currently present in codebase

**Runner:** Not configured
- No `vitest.config.ts`, `jest.config.js`, or test runner config files found
- No test framework dependencies in package.json files

**Assertion Library:** Not configured
- No testing libraries listed in devDependencies (no `vitest`, `jest`, `mocha`, `chai`, etc.)

**Run Commands:** Not applicable
- No test scripts in package.json files
- Only available scripts: `build`, `dev`, `lint`, `format`, `check-types`

## Test File Organization

**Location:** Not applicable - no test files exist
- Search found no `.test.ts`, `.test.tsx`, `.spec.ts`, or `.spec.tsx` files in `/packages/*`
- Codebase is test-free

**Naming:** No convention established

**Structure:** No convention established

## Test Structure

**Recommendation for Future Tests:**

When tests are added, follow these TypeScript/monorepo patterns from similar projects:

**Suggested Organization:**
- Co-located tests: Place `.test.ts` files adjacent to source files
  - Example: `packages/core/src/index.test.ts` next to `packages/core/src/index.ts`
- Separate test directory structure:
  - Alternative: `packages/core/__tests__/index.test.ts`

**Test Suite Structure:**
```typescript
// Suggested pattern (not currently used)
describe("createZodIntelligence", () => {
  describe("getSuggestions", () => {
    it("should return keyword suggestions matching input", () => {
      // arrange
      const intelligence = createZodIntelligence();

      // act
      const suggestions = intelligence.getSuggestions({
        text: "z.ob",
        offset: 4,
        word: "z.ob",
      });

      // assert
      expect(suggestions).toContainEqual(
        expect.objectContaining({ label: "z.object" })
      );
    });
  });
});
```

## Mocking

**Framework:** Not configured
- No mocking framework selected (Would typically use vitest or Jest built-ins)

**Patterns:** Not established

**What to Mock (When Tests Are Added):**
- External dependencies: Monaco API interfaces (`MonacoApi`, `MonacoStandaloneEditorLike`)
- Third-party: DOM elements in mount tests
- Consider: Zod schema instances in registry tests

**What NOT to Mock:**
- Pure utility functions: `normalizeNeedle()`, `includesNeedle()`
- State management logic: `SchemaRegistry` class
- Core intelligence: `createZodIntelligence()` factory

## Fixtures and Factories

**Test Data:** Not established
- No fixtures directory or factory functions present
- Recommend creating when tests are added

**Suggested Location:**
```
packages/core/
├── src/
│   └── index.ts
├── __tests__/
│   ├── fixtures/
│   │   └── schemas.ts          # Test schema definitions
│   └── index.test.ts
```

**Suggested Pattern:**
```typescript
// packages/core/__tests__/fixtures/schemas.ts
export const mockUserSchema = {
  name: "User",
  schema: { /* zod schema */ },
  description: "User registration schema",
  fields: [
    {
      path: "email",
      description: "User email address",
      detail: "Must be valid email",
    },
  ],
} as const;

export const mockSchemaRegistry = () => {
  const registry = new SchemaRegistry();
  registry.register(mockUserSchema);
  return registry;
};
```

## Coverage

**Requirements:** No coverage enforced
- No `coverage` script in package.json
- No coverage configuration (no `c8`, `nyc`, or jest coverage config)

**Recommendation:** When testing framework is selected, set target to 80%+ for core packages

**View Coverage:** Not currently possible
- Command to implement: `vitest run --coverage` (if vitest is adopted)

## Test Types

**Unit Tests:** Recommended focus when testing is added
- **Scope:** Individual functions and classes
- **Approach for `packages/core`:**
  - Test `createZodIntelligence()` factory with various options
  - Test `SchemaRegistry` registration, retrieval, listing
  - Test `getSuggestions()` with keyword matching, schema matching, field matching
  - Test `getHover()` with schemas, fields, keywords, null cases
  - Test `getDiagnostics()` bracket matching, edge cases

- **Approach for `packages/monaco`:**
  - Test `registerZodMonacoLanguage()` registration and reference counting
  - Test `createZodEditorController()` and `DefaultZodEditorController` class
  - Test provider creation: `createProviderDisposable()`
  - Test type conversion functions: `toCompletionKind()`, `toSeverity()`, `toMarkers()`, `toHover()`
  - Test mount/unmount lifecycle

- **Approach for `packages/react`:**
  - Test `ZodMonacoEditor` component rendering
  - Test prop updates (value, defaultValue, onChange)
  - Test mounting/unmounting lifecycle
  - Test effect dependencies

**Integration Tests:** Optional, for cross-package interactions
- **Scope:** Multiple packages working together
- **Examples:**
  - `@zod-monaco/core` + `@zod-monaco/monaco` - Editor controller with intelligence
  - `@zod-monaco/monaco` + `@zod-monaco/react` - React component with editor controller

**E2E Tests:** Not recommended for this library
- This is a developer tool library, not a user-facing application
- Browser/playwright tests not necessary
- Focus on unit and integration tests

## Common Patterns

**Async Testing:** Not needed for current codebase
- All functions are synchronous
- No async/await or promises present
- No API calls or timers

**Error Testing:** Would test thrown errors
```typescript
// Suggested pattern
describe("registerZodMonacoLanguage", () => {
  it("should throw when registering same language with different intelligence", () => {
    const monaco = createMockMonaco();
    const intel1 = createZodIntelligence();
    const intel2 = createZodIntelligence();

    registerZodMonacoLanguage(monaco, intel1, "test-lang");

    expect(() => {
      registerZodMonacoLanguage(monaco, intel2, "test-lang");
    }).toThrow(
      /already registered with a different intelligence instance/
    );
  });
});
```

**Snapshot Testing:** Not recommended
- Avoid snapshots for suggestion/hover data
- Use explicit assertions instead
- Snapshots make tests brittle to refactoring

**React Hook Testing:**
When testing `packages/react/src/index.tsx` ZodMonacoEditor component:
```typescript
// Would use @testing-library/react
describe("ZodMonacoEditor", () => {
  it("mounts editor on first render", () => {
    const { container } = render(
      <ZodMonacoEditor
        monaco={mockMonaco}
        intelligence={createZodIntelligence()}
      />
    );

    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it("calls onMount callback with editor and controller", () => {
    const onMount = jest.fn();

    render(
      <ZodMonacoEditor
        monaco={mockMonaco}
        intelligence={createZodIntelligence()}
        onMount={onMount}
      />
    );

    expect(onMount).toHaveBeenCalledWith(
      expect.objectContaining({ getValue: expect.any(Function) }),
      expect.objectContaining({ mount: expect.any(Function) })
    );
  });
});
```

## Test Framework Recommendation

**Suggested Framework:** Vitest
- Reason: Fast, ESM-first, works great with TypeScript monorepos
- Configuration location: Root `vitest.config.ts`
- Per-package setup: Optional `vitest.config.ts` overrides if needed

**Alternative:** Jest with TypeScript
- Reason: More batteries-included, wider adoption
- Would require `babel-jest` or `ts-jest` for TypeScript

**Implementation Priority:**
1. Set up test runner (vitest or jest)
2. Add tests for `@zod-monaco/core` (most logic-heavy package)
3. Add tests for `@zod-monaco/monaco` (complex lifecycle)
4. Add tests for framework adapters (react, vue, angular)
5. Aim for 80%+ coverage on core functionality

---

*Testing analysis: 2026-03-12*
