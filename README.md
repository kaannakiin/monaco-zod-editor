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
  Schema traversal supports records (`z.record`), tuples (`z.tuple`),
  intersections (`.and()`), discriminated unions, nullable types, and recursive
  schemas (`z.lazy`).
- `@zod-monaco/monaco` is the framework-agnostic Monaco controller with JSON
  Schema validation, Zod runtime diagnostics, hover tooltips, auto-completions,
  breadcrumb navigation, and full native Monaco API passthrough (themes, options).
  It also provides `attachZodToEditor()` for attaching Zod features to any
  existing editor instance, and a shared schema registry that allows multiple
  editors to coexist on the same Monaco namespace without conflicts.
- `apps/web` is a live JSON editor demo powered by the above packages.

## Workspace Layout

- `apps/web`: live JSON editor demo (Next.js)
- `apps/angular-web`: Angular demo
- `packages/core`: Zod v4 schema descriptor and metadata resolution
- `packages/monaco`: Monaco JSON controller with native API passthrough
- `packages/typescript-config`: shared TypeScript config
- `packages/eslint-config`: shared ESLint config

## Commands

```sh
pnpm check-types
pnpm --filter @zod-monaco/core test
pnpm --filter @zod-monaco/monaco test
pnpm --filter web dev
```

## Theme Customization

Register custom themes via the `onLoad` callback:

```ts
import { loadMonaco, attachZodToEditor } from "@zod-monaco/monaco";

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

const editor = monaco.editor.create(container, {
  language: "json",
  theme: "my-theme",
  value: "{}",
});

attachZodToEditor({ monaco, editor, descriptor: myDescriptor });
```

For full Monaco IntelliSense on the escape-hatch types (`RawMonaco`,
`RawMonacoEditor`), install `monaco-editor` as a devDependency.

## Attach to Existing Editor

If you already have a Monaco editor instance (from `@monaco-editor/react`,
`@ng-util/monaco-editor`, or raw `monaco.editor.create()`), use
`attachZodToEditor` to add Zod features without replacing your editor setup:

```ts
import { loadMonaco, attachZodToEditor } from "@zod-monaco/monaco";

const monaco = await loadMonaco();
const editor = monaco.editor.create(document.getElementById("editor")!, {
  language: "json",
  value: "{}",
});

const attachment = attachZodToEditor({
  monaco,
  editor,
  descriptor: myDescriptor,
});

// Update schema at runtime
attachment.setDescriptor(anotherDescriptor);

// Listen to validation results
attachment.onValidationChange((result) => {
  console.log(result.valid, result.issues);
});

// Clean up Zod features (does NOT dispose the editor)
attachment.dispose();
```

## Multiple Editors

Multiple editors can share the same Monaco instance without conflicts. Each
editor's schema is managed through an internal registry that merges all active
schemas into a single configuration. Disposing one editor does not affect
others — no extra setup required.

## Localization

Hover tooltip labels default to English. Pass a `locale` to switch to a
built-in language or supply your own plain-text labels — no Markdown knowledge
required.

```ts
import { createZodEditorController, locales } from "@zod-monaco/monaco";

// Built-in Turkish
createZodEditorController({ monaco, descriptor, locale: locales.tr });

// Custom labels (plain text, no markdown)
createZodEditorController({
  monaco,
  descriptor,
  locale: { ...locales.en, required: "Pflichtfeld", optional: "Optional" },
});
```

Available built-ins: `locales.en` (default), `locales.tr`.

The `ZodMonacoLocale` interface has five plain-text fields: `required`,
`optional`, `examples`, `placeholder`, `enumValues`. The library applies
bold/italic formatting automatically.
