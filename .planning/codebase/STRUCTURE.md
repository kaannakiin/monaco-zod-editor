# Codebase Structure

**Analysis Date:** 2026-03-13

## Layout

```
zod-monaco/
├── .planning/
├── apps/
│   └── web/
├── packages/
│   ├── core/
│   ├── monaco/
│   ├── react/
│   ├── vue/
│   ├── angular/
│   ├── eslint-config/
│   └── typescript-config/
├── README.md
├── ARCHITECTURE.md
├── MONACO_ZOD_ROADMAP.md
└── CLAUDE.md
```

## Package Roles

- `packages/core`
  - Empty shell reserved for upcoming Zod v4 runtime logic
- `packages/monaco`
  - Minimal editor controller and Monaco type shims
- `packages/react`
  - `ZodMonacoEditor` wrapper around the controller
- `packages/vue`
  - Vue-flavored controller wrapper
- `packages/angular`
  - Angular-flavored controller wrapper
- `apps/web`
  - Status page only

## Key Entry Points

- `packages/core/src/index.ts`
- `packages/monaco/src/index.ts`
- `packages/react/src/index.tsx`
- `packages/vue/src/index.ts`
- `packages/angular/src/index.ts`
- `apps/web/app/page.tsx`

## Where New Work Should Land

- Zod v4 schema input and JSON Schema generation: `packages/core`
- Monaco JSON diagnostics and runtime marker wiring: `packages/monaco`
- First end-to-end consumer API: `packages/react`
- Honest showcase once features are real: `apps/web`
