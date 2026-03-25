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
  schemas (`z.lazy`). The core package also exposes a field resolution and
  catalog layer for building AI-powered JSON editing features (see below).
- `@zod-monaco/monaco` is the framework-agnostic Monaco controller with JSON
  Schema validation, Zod runtime diagnostics, hover tooltips, auto-completions,
  breadcrumb navigation, and full native Monaco API passthrough (themes, options).
  It also provides `attachZodToEditor()` for attaching Zod features to any
  existing editor instance, a shared schema registry that allows multiple
  editors to coexist on the same Monaco namespace without conflicts, and
  `prepareJsonEdit()` for safe AI-assisted JSON editing (see below).
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

## AI Integration

`@zod-monaco/core` exposes a field catalog and diff layer that lets you send
structured schema context to an AI backend, then safely apply the response
back to the editor.

### Field catalog — send schema context to AI

`buildFieldCatalog` walks the JSON Schema and produces a clean, serializable
field list — no raw `$ref`, `$defs`, or `oneOf` exposed to the model.

```ts
import { buildFieldCatalog } from "@zod-monaco/core";

const catalog = buildFieldCatalog(descriptor, {
  currentValue: JSON.parse(editor.getValue()), // optional — overlaid as currentValue
  maxDepth: 15,
  recursionUnrollDepth: 1, // recursive schemas shown 1 level deep
});

// catalog.root     — entry for the root object
// catalog.fields   — flat ordered list of all fields
// field.pointer    — RFC 6901 JSON Pointer ("/metadata/owner/email")
// field.typeInfo   — type, nullable, enum, min/max, format, …
// field.branches   — present on union fields (oneOf/anyOf); each branch
//                    has its own fields list so the AI never mixes branches
// field.recursive  — true when cut by recursionUnrollDepth
```

Union branches are never flattened into the top-level list — they are grouped
in `field.branches` so the AI can see which fields belong to which variant:

```ts
// content (kind: "text" | "binary" | "link")
const content = catalog.fields.find(f => f.pointer === "/content");
content.branches[0].discriminatorValue; // "text"
content.branches[0].fields;             // [{ pointer: "/content/body" }, …]
content.branches[1].discriminatorValue; // "binary"
content.branches[1].fields;             // [{ pointer: "/content/sizeBytes" }, …]
```

Use `focusPath` to restrict the catalog to a subtree (saves tokens):

```ts
const catalog = buildFieldCatalog(descriptor, {
  currentValue,
  focusPath: ["metadata", "owner"],
});
```

### Prepare / review / commit — apply AI output safely

`prepareJsonEdit` from `@zod-monaco/monaco` validates and diffs an AI response
without touching the editor. The user reviews the diff before anything is
written.

```ts
import { prepareJsonEdit } from "@zod-monaco/monaco";

// 1. Prepare — editor is NOT modified
const prepared = prepareJsonEdit(editor, descriptor, aiResponse.value);

// 2. Inspect before showing review UI
prepared.valid;             // boolean — whether value passes Zod validation
prepared.validationIssues;  // ValidationIssue[] — path, pointer, message
prepared.diff;              // FieldDiff[] — added / removed / changed entries
prepared.newText;           // formatted JSON string (for diff editor)
prepared.stale;             // true if the editor was edited during review

// 3. Show diff review, then on accept:
if (prepared.stale) {
  // Editor changed while user was reviewing — re-prepare
} else {
  prepared.commit(); // writes to editor via executeEdits
}

// 4. On reject — nothing to undo, editor was never touched
```

`commit()` throws if `valid` is false. Use `{ force: true }` to override:

```ts
prepared.commit({ force: true }); // write even if invalid
```

### Diff — compute what changed

`computeJsonDiff` from `@zod-monaco/core` is the same function used internally
by `prepareJsonEdit`. Call it directly if you need the diff without an editor:

```ts
import { computeJsonDiff } from "@zod-monaco/core";

const diffs = computeJsonDiff(oldValue, newValue);
// [{ path: ["tags", 1], pointer: "/tags/1", action: "added", newValue: "v2" }]
```

### Field path utilities

```ts
import { toJsonPointer, fromJsonPointer } from "@zod-monaco/core";

toJsonPointer(["metadata", "owner", "email"]); // "/metadata/owner/email"
toJsonPointer(["items", 0, "name"]);            // "/items/0/name"
fromJsonPointer("/a~1b/c~0d");                  // ["a/b", "c~d"]
```

`fromJsonPointer` always returns `string[]` — it does not coerce numeric
segments to `number`. Typed `FieldPath` values (`ReadonlyArray<string | number>`)
come from the catalog and resolver, not from pointer parsing.

### Package boundaries

The library intentionally does not include prompt formatting, LLM calls, or
review UI — those belong in the app layer. The library provides:

| Package | Exports |
| ------- | ------- |
| `@zod-monaco/core` | `buildFieldCatalog`, `computeJsonDiff`, `resolveFieldContext`, `toJsonPointer`, `fromJsonPointer` |
| `@zod-monaco/monaco` | `prepareJsonEdit` |

The app is responsible for serializing the catalog into a prompt, calling the
AI backend, and rendering the diff review UI.
