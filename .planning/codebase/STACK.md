# Technology Stack

**Analysis Date:** 2026-03-12

## Languages

**Primary:**
- TypeScript 5.9.2 - Core language used across all packages and applications

## Runtime

**Environment:**
- Node.js >= 18 (specified in root package.json engines field)

**Package Manager:**
- pnpm 9.0.0
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**
- React 19.2.0 - Used in `apps/web` application and for React bindings
- Next.js 16.1.5 - Web application framework in `apps/web`
- Angular >= 18.0.0 - Peer dependency for `@zod-monaco/angular` package
- Vue 3.5.0 - Peer dependency for `@zod-monaco/vue` package

**Build/Dev:**
- Turbo 2.8.16 - Monorepo task runner and build orchestration
- Prettier 3.7.4 - Code formatting (at root level)
- ESLint 9.39.1 - Linting (in `apps/web`)
- TypeScript compiler (tsc) - Direct TypeScript compilation for library packages

## Key Dependencies

**Critical:**
- zod ^4.0.0 - Peer dependency for `@zod-monaco/core`. The core package provides schema validation intelligence for Zod schemas
- monaco-editor ^0.52.0 - Peer dependency for `@zod-monaco/monaco`, `@zod-monaco/react`, `@zod-monaco/angular`, and `@zod-monaco/vue`. Provides the editor runtime

**Type Support:**
- @types/react 19.2.2 - Type definitions for React in web app
- @types/react-dom 19.2.2 - Type definitions for React DOM
- @types/node ^22.15.3 - Type definitions for Node APIs in web app

## Configuration

**Environment:**
- No environment variables configured at project level (no .env files found)
- Each package is self-contained with peer dependencies declared in package.json

**Build:**
- TypeScript configurations via `tsconfig.json` in each package
- Turbo task configuration in `/Users/kaanakin/Desktop/zod-monaco/turbo.json`:
  - `build`: Depends on workspace dependencies, outputs to `.next/**` and `dist/**`
  - `lint`: Depends on workspace linting tasks
  - `check-types`: Depends on workspace type checking
  - `dev`: Development server without caching, persistent mode enabled

## Workspace Structure

**Monorepo:** Uses Turbo for multi-package coordination

**Package Manager:** pnpm with workspace protocol (`workspace:*`) for internal dependencies

**Packages:**
- `packages/core` - Core Zod intelligence engine
- `packages/monaco` - Monaco editor integration layer
- `packages/react` - React component binding
- `packages/angular` - Angular component binding
- `packages/vue` - Vue component binding
- `packages/eslint-config` - Shared ESLint configuration
- `packages/typescript-config` - Shared TypeScript configuration
- `apps/web` - Next.js demo application

## Platform Requirements

**Development:**
- Node.js 18 or higher
- pnpm 9.0.0
- TypeScript knowledge for package development
- React/Angular/Vue knowledge for respective framework bindings

**Production:**
- Web deployment via Next.js (supports Vercel or standard Node.js hosting)
- Library packages published to npm as:
  - @zod-monaco/core
  - @zod-monaco/monaco
  - @zod-monaco/react
  - @zod-monaco/angular
  - @zod-monaco/vue

---

*Stack analysis: 2026-03-12*
