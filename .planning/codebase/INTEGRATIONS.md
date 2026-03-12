# External Integrations

**Analysis Date:** 2026-03-12

## APIs & External Services

**None detected** - This is a library-focused monorepo with no external API integrations in the core codebase.

## Data Storage

**Databases:**
- None - This is a client-side editor library with no database integration

**File Storage:**
- Not applicable

**Caching:**
- In-memory registration cache using WeakMap (`packages/monaco/src/index.ts` lines 166-169)
  - Language registration state cached per Monaco instance to optimize re-registration

## Authentication & Identity

**Auth Provider:**
- None - No authentication system. Library operates client-side without auth requirements

## Monitoring & Observability

**Error Tracking:**
- None configured

**Logs:**
- Console-based only (implicit via browser console or Node.js stdout)
- No dedicated logging framework

## CI/CD & Deployment

**Hosting:**
- Web demo app (`apps/web`) intended for Vercel or standard Node.js hosting
- Library packages published to npm registry

**CI Pipeline:**
- Turbo task orchestration configured in `turbo.json`
- Build, lint, and type-check tasks defined
- No external CI/CD service integration detected (e.g., GitHub Actions)

## Environment Configuration

**Required env vars:**
- None - Project does not require environment variables for operation

**Secrets location:**
- Not applicable - No secrets management configured

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- Event listener pattern used for editor changes:
  - `MonacoEditorChangeEvent` fired from editor changes (`packages/monaco/src/index.ts` lines 62-64)
  - Consumer callbacks registered via `onChange()` method in `ZodEditorController` (`packages/monaco/src/index.ts` lines 147-155)

## Framework Integrations

**React Integration:**
- React 19.2.0 integration via `@zod-monaco/react` package
- Uses React hooks: `useEffect`, `useRef` for lifecycle management
- Component: `ZodMonacoEditor` in `packages/react/src/index.tsx`
- Mounts unmanaged Monaco editor instance into React refs
- Props-based value control and change callbacks

**Angular Integration:**
- Angular >= 18.0.0 integration via `@zod-monaco/angular` package
- Provides `createZodMonacoAngularController` for form control compatibility
- Implements `registerOnChange`, `registerOnTouched`, and `writeValue` patterns
- Controller: `ZodMonacoAngularController` in `packages/angular/src/index.ts`

**Vue Integration:**
- Vue 3.5.0 integration via `@zod-monaco/vue` package
- Provides `createZodMonacoVueController` for v-model compatibility
- Methods: `getModelValue()`, `setModelValue()`, `onModelValueChange()`
- Controller: `ZodMonacoVueController` in `packages/vue/src/index.ts`

## Peer Dependencies

**Monaco Editor Integration:**
- `monaco-editor` ^0.52.0 - All packages depend on Monaco editor as peer dependency
- Provides editor instance, language registration API, completion providers, hover providers
- Models abstracted through interfaces (`MonacoModelLike`, `MonacoEditorApi`, `MonacoLanguagesApi`)

**Zod Schema Support:**
- `zod` ^4.0.0 - Core package uses Zod as peer dependency
- No direct Zod imports in code - library accepts Zod schemas as registered objects
- Schema registry allows custom Zod schema registration at runtime

## Data Flow Pattern

**Editor Intelligence System:**
1. User provides `ZodIntelligence` instance (created from `createZodIntelligence()`)
2. Intelligence registers with Monaco language (`registerZodMonacoLanguage()`)
3. Monaco editor fires completion/hover requests
4. Language providers query intelligence for suggestions/hover info
5. Intelligence returns formatted results based on schema registry and keywords
6. Results mapped to Monaco format and displayed

**Diagnostic Flow:**
1. Editor content changes trigger `onDidChangeModelContent` listener
2. Diagnostics computed from text via `getDiagnostics()`
3. Bracket matching validation performed
4. Results set as editor markers via `setModelMarkers()`

---

*Integration audit: 2026-03-12*
