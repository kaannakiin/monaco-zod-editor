# Coding Conventions

**Analysis Date:** 2026-03-13

## Naming

- Keep public entry points in `src/index.ts` or `src/index.tsx`.
- Use `create*` for factories such as `createZodEditorController`.
- Keep framework wrappers thin and descriptive.

## Style

- TypeScript strict mode stays enabled.
- Prettier and ESLint remain the baseline formatting and linting tools.
- Prefer small files until real feature logic lands.

## Architectural Convention

- `core` owns schema/runtime behavior.
- `monaco` owns editor integration only.
- Wrappers should adapt, not reinvent, controller behavior.
- Documentation must reflect the JSON-only product direction before feature work
  is merged.
