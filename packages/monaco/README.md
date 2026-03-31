# @zod-monaco/monaco

Monaco editor adapter with Zod-powered JSON validation, hover tooltips, completions, suggestion refinements, and AI-safe editing.

## Installation

```bash
npm install @zod-monaco/monaco @zod-monaco/core zod
```

## Monaco Loading

This package loads Monaco editor from CDN (v0.52.2) via AMD. Use `loadMonaco()` to load it:

```ts
import { loadMonaco } from "@zod-monaco/monaco";

const monaco = await loadMonaco();
```

## Usage

```ts
import { loadMonaco, createZodEditorController } from "@zod-monaco/monaco";
import { describeSchema } from "@zod-monaco/core";
import { z } from "zod";

const monaco = await loadMonaco();

const descriptor = describeSchema(
  z.object({ name: z.string(), age: z.number() }),
);

const controller = createZodEditorController({
  monaco,
  descriptor,
  value: '{ "name": "", "age": 0 }',
});

const editor = controller.mount(document.getElementById("editor")!);

controller.onChange((value) => {
  console.log("JSON changed:", value);
});

controller.onValidationChange((result) => {
  console.log("Valid:", result.valid, "Issues:", result.issues);
});
```

## Features

All features are enabled by default and can be toggled:

```ts
const controller = createZodEditorController({
  monaco,
  descriptor,
  features: {
    hover: true,        // metadata hover tooltips
    validation: true,   // JSON Schema structural validation
    diagnostics: true,  // Zod runtime validation markers
    completions: true,  // enum value completions + suggestion refinements
  },
});
```

## Suggestion Refinements

Inject runtime suggestions into free-text fields without touching the schema:

```ts
const controller = createZodEditorController({
  monaco,
  descriptor,
  refinements: [
    {
      path: ["template"],
      suggestions: ["{Name}", "{Price}", "{Category}"],
      triggerPattern: "\\{",
    },
  ],
});
```

`triggerPattern` is a regex string. When provided, suggestions only appear after the text before the cursor matches that pattern. Simple single-character patterns (`"@"`, `"\\{"`) are also registered as Monaco trigger characters — completions open automatically when the user types that character.

Update refinements at runtime without remounting:

```ts
controller.setRefinements([
  {
    path: ["template"],
    suggestions: ["{Name}", "{Price}"],
    triggerPattern: "\\{",
  },
]);
```

**Completion priority:** Enum values from the JSON Schema always take precedence. Suggestion refinements are shown only when no enum values exist for the current field.

Suggestion refinements are soft — they do not add validation constraints. For strict enum validation, use `EnumRefinement` in `describeSchema`.

## Attach to Existing Editor

If you already have a Monaco editor instance, use `attachZodToEditor` to add Zod features without replacing your setup:

```ts
import { attachZodToEditor } from "@zod-monaco/monaco";

const attachment = attachZodToEditor({
  monaco,
  editor,
  descriptor,
  refinements: [
    { path: ["content"], suggestions: ["{Name}", "{Price}"], triggerPattern: "\\{" },
  ],
});

attachment.setDescriptor(anotherDescriptor); // swap schema at runtime
attachment.setRefinements([...]);            // update suggestions at runtime
attachment.onValidationChange((result) => console.log(result));
attachment.dispose(); // removes Zod features, does NOT dispose the editor
```

## AI-Safe Editing — `prepareJsonEdit`

`prepareJsonEdit` applies an AI-generated value safely: it validates and diffs without touching the editor. The user reviews the diff before anything is written.

```ts
import { prepareJsonEdit } from "@zod-monaco/monaco";
import { buildFieldCatalog } from "@zod-monaco/core";

// 1. Build catalog and send to AI (app's responsibility)
const catalog = buildFieldCatalog(descriptor, { currentValue });
const aiResponse = await callYourAI(catalog); // { value: {...} }

// 2. Prepare — editor is NOT modified
const prepared = prepareJsonEdit(editor, descriptor, aiResponse.value);

// 3. Inspect before showing review UI
prepared.valid;             // boolean — passes Zod validation?
prepared.validationIssues;  // ValidationIssue[] — { path, pointer, message }
prepared.diff;              // FieldDiff[] — added / removed / changed
prepared.newText;           // formatted JSON string (use in diff editor)
prepared.stale;             // true if editor was edited during review

// 4. On accept:
if (prepared.stale) {
  // editor changed while reviewing — call prepareJsonEdit again
} else {
  prepared.commit(); // now writes to editor via executeEdits
}

// 5. On reject — nothing to undo, editor was never touched
```

`commit()` throws if `valid` is false. Use `{ force: true }` to override:

```ts
prepared.commit({ force: true });
```

## Localization

```ts
import { createZodEditorController, locales } from "@zod-monaco/monaco";

createZodEditorController({ monaco, descriptor, locale: locales.tr }); // Turkish
createZodEditorController({
  monaco,
  descriptor,
  locale: { ...locales.en, required: "Pflichtfeld" },
});
```

Available built-ins: `locales.en` (default), `locales.tr`.

## Multiple Editors

Multiple editors sharing the same Monaco instance are supported. Each editor's schema is managed through an internal registry — disposing one does not affect others — no extra setup required.

## API

### `createZodEditorController(options)`

- `mount(element)` — mount editor to a DOM element
- `getValue()` / `setValue(value)` — read/write editor content
- `setDescriptor(descriptor)` — update schema without remounting
- `setRefinements(refinements)` — update suggestion refinements at runtime
- `onChange(listener)` — subscribe to content changes
- `onValidationChange(listener)` — subscribe to validation results
- `onCursorPathChange(listener)` — subscribe to breadcrumb path changes
- `revealIssue(issue)` — navigate to a Zod issue in the editor
- `revealPath(path)` — navigate to a path in the editor
- `format()` — format JSON (also bound to Ctrl+S)
- `updateOptions(options)` — update editor options at runtime
- `getMonaco()` / `getRawEditor()` — escape hatch to native Monaco APIs
- `dispose()` — cleanup

### `attachZodToEditor(options)`

Returns a `ZodEditorAttachment`:

- `setDescriptor(descriptor)` — swap schema at runtime
- `setRefinements(refinements)` — update suggestion refinements at runtime
- `onValidationChange(listener)` — subscribe to validation results
- `onCursorPathChange(listener)` — subscribe to breadcrumb path changes
- `dispose()` — remove Zod features (does NOT dispose the editor)

### `prepareJsonEdit(editor, descriptor, newValue)`

Returns a `PreparedEdit`:

| Field | Type | Description |
| ----- | ---- | ----------- |
| `newText` | `string` | Formatted JSON of the proposed value |
| `valid` | `boolean` | Passes Zod validation |
| `validationIssues` | `ValidationIssue[]` | `{ path, pointer, message }` per issue |
| `diff` | `FieldDiff[]` | Added / removed / changed fields |
| `stale` | `boolean` (getter) | Editor changed since prepare was called |
| `commit(opts?)` | `void` | Write to editor — throws if invalid or stale |

## License

MIT
