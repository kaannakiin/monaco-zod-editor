# @zod-monaco/core

Zod v4 runtime bridge for JSON Schema generation and validation. Converts Zod schemas into JSON Schema and provides a validation interface used by the Monaco editor packages.

## Installation

```bash
npm install @zod-monaco/core zod
```

## Usage

```ts
import { z } from "zod";
import { describeSchema } from "@zod-monaco/core";

const schema = z.object({
  name: z.string(),
  age: z.number().min(0),
});

const descriptor = describeSchema(schema, {
  metadata: {
    title: "User",
    description: "A user record",
    fields: {
      name: { title: "Name", description: "Full name" },
      age: { title: "Age", placeholder: "25" },
    },
  },
});

// descriptor.jsonSchema  — JSON Schema object
// descriptor.validate    — (json: unknown) => ZodSafeParseResult
// descriptor.metadata    — resolved field metadata
```

## API

### `describeSchema(schema, options?)`

Creates a `SchemaDescriptor` from a Zod v4 schema.

- `schema` — any Zod v4 schema
- `options.metadata` — optional field-level metadata (title, description, examples, placeholder, enumLabels, emptyStateHint)
- `options.toJsonSchemaOptions` — options passed to Zod's `toJSONSchema()`

### `resolveFieldMetadata(descriptor, path)`

Resolves metadata for a field at a given JSON path, merging explicit metadata with JSON Schema-derived information.

## License

MIT
