# @zod-monaco/react

React component for Zod-powered Monaco JSON editor. Wraps `@zod-monaco/monaco` with a React component that handles mounting, lifecycle, and controlled/uncontrolled value patterns.

## Installation

```bash
npm install @zod-monaco/react @zod-monaco/core zod
```

## Usage

```tsx
import { loadMonaco, ZodMonacoEditor } from "@zod-monaco/react";
import { describeSchema } from "@zod-monaco/core";
import { z } from "zod";
import { useEffect, useState } from "react";

const descriptor = describeSchema(
  z.object({ name: z.string(), age: z.number() }),
);

function App() {
  const [monaco, setMonaco] = useState(null);

  useEffect(() => {
    loadMonaco().then(setMonaco);
  }, []);

  if (!monaco) return <div>Loading editor...</div>;

  return (
    <ZodMonacoEditor
      monaco={monaco}
      descriptor={descriptor}
      defaultValue='{ "name": "", "age": 0 }'
      onChange={(value) => console.log(value)}
      onValidationChange={(result) => console.log(result.valid)}
      style={{ height: 400 }}
    />
  );
}
```

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `monaco` | `MonacoApi` | Monaco instance from `loadMonaco()` |
| `descriptor` | `SchemaDescriptor` | Schema descriptor from `describeSchema()` |
| `value` | `string` | Controlled value |
| `defaultValue` | `string` | Initial value (uncontrolled) |
| `features` | `FeatureToggles` | Enable/disable hover, validation, diagnostics, completions |
| `onChange` | `(value, event) => void` | Content change callback |
| `onValidationChange` | `(result) => void` | Validation result callback |
| `onMount` | `(editor, controller) => void` | Called after editor mounts |
| `editorOptions` | `Record<string, unknown>` | Passed to Monaco editor |
| `validationDelay` | `number` | Debounce delay in ms (default: 300) |

All standard `div` HTML attributes are also supported.

## Note

Monaco is loaded from CDN. See `@zod-monaco/monaco` for details.

## License

MIT
