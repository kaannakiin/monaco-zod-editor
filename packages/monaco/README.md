# @zod-monaco/monaco

Monaco editor adapter with Zod-powered JSON validation, hover tooltips, and completions. Provides a controller that mounts Monaco, wires up JSON Schema validation from Zod, and adds metadata-driven UX.

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
    completions: true,  // enum value completions
  },
});
```

## API

### `createZodEditorController(options)`

Creates a controller that manages a Monaco editor instance.

- `mount(element)` — mount editor to a DOM element
- `getValue()` / `setValue(value)` — read/write editor content
- `setDescriptor(descriptor)` — update schema without remounting
- `onChange(listener)` — subscribe to content changes
- `onValidationChange(listener)` — subscribe to validation results
- `revealIssue(issue)` — navigate to a Zod issue in the editor
- `format()` — format JSON (also bound to Ctrl+S)
- `dispose()` — cleanup

## License

MIT
