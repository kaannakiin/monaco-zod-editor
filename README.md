# zod-monaco

`zod-monaco` is a Turborepo workspace for a Monaco-based JSON editor powered by
Zod v4.

## Product Direction

- Users edit JSON, not Zod code.
- Zod v4 stays behind the editor and will provide JSON Schema generation,
  runtime validation, and metadata-aware UX.
- Monaco should rely on its built-in JSON language service.
- Rich hover and example content should come from a separate metadata input.

## Current Status

- `@zod-monaco/core` provides `describeSchema()` — the Zod v4 → JSON Schema
  bridge with field-level metadata (titles, descriptions, examples, placeholders).
- `@zod-monaco/monaco` is the framework-agnostic Monaco controller with JSON
  Schema validation, Zod runtime diagnostics, hover tooltips, auto-completions,
  breadcrumb navigation, and full native Monaco API passthrough (themes, options).
- `@zod-monaco/react`, `@zod-monaco/vue`, and `@zod-monaco/angular` are thin
  framework wrappers around that controller.
- `apps/web` is a live JSON editor demo powered by the above packages.

## Workspace Layout

- `apps/web`: live JSON editor demo (Next.js)
- `apps/angular-web`: Angular demo
- `packages/core`: Zod v4 schema descriptor and metadata resolution
- `packages/monaco`: Monaco JSON controller with native API passthrough
- `packages/react`: React wrapper (`<ZodMonacoEditor />`)
- `packages/vue`: Vue wrapper
- `packages/angular`: Angular wrapper
- `packages/typescript-config`: shared TypeScript config
- `packages/eslint-config`: shared ESLint config

## Commands

```sh
pnpm check-types
pnpm --filter @zod-monaco/core test
pnpm --filter web dev
```

## Theme Customization

Register custom themes via the `onLoad` callback, then apply them reactively:

```tsx
import { loadMonaco, ZodMonacoEditor } from "@zod-monaco/react";

const monaco = await loadMonaco({
  onLoad(m) {
    m.editor.defineTheme("my-theme", {
      base: "vs-dark",
      inherit: true,
      rules: [],
      colors: { "editor.background": "#0d1117" },
    });
  },
});

<ZodMonacoEditor monaco={monaco} theme="my-theme" descriptor={myDescriptor} />
```

For full Monaco IntelliSense on the escape-hatch types (`RawMonaco`,
`RawMonacoEditor`), install `monaco-editor` as a devDependency.
