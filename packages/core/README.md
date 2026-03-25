# @zod-monaco/core

Zod v4 runtime bridge for JSON Schema generation, field resolution, and AI-ready field catalog.

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

---

### `resolveFieldContext(descriptor, path, cache?)`

Resolves the full context for a field — type info, metadata, and required status — in a single call. Used internally by hover, completions, and the catalog builder.

```ts
import { resolveFieldContext } from "@zod-monaco/core";

const ctx = resolveFieldContext(descriptor, ["metadata", "owner", "email"]);
ctx.typeInfo.type;       // "string"
ctx.typeInfo.format;     // "email"
ctx.typeInfo.nullable;   // false
ctx.metadata?.title;     // "Owner's email address"
ctx.required;            // true
```

`path` is a `FieldPath = ReadonlyArray<string | number>`. Numeric segments represent array indices.

---

### `buildFieldCatalog(descriptor, options?)`

Walks the JSON Schema and produces a clean, serializable field list — suitable for sending to an AI backend. Works without a current value (schema-first); the value is an optional overlay.

```ts
import { buildFieldCatalog } from "@zod-monaco/core";

const catalog = buildFieldCatalog(descriptor, {
  currentValue: JSON.parse(editor.getValue()), // optional
  maxDepth: 15,
  recursionUnrollDepth: 1, // recursive schemas shown 1 level deep
  focusPath: ["metadata"], // only enumerate a subtree (saves tokens)
});

// catalog.root     — entry for the root object
// catalog.fields   — flat ordered list of all fields
```

Each `FieldCatalogEntry` has:

| Field | Description |
| ----- | ----------- |
| `path` | `FieldPath` — typed path segments |
| `pointer` | RFC 6901 JSON Pointer (`"/metadata/owner/email"`), or `null` for wildcard entries |
| `pathPattern` | Wildcard pattern (`"/items/*"`) — only for array-item and record entries |
| `typeInfo` | Type, nullable, enum, min/max, format, … |
| `required` | Whether the field is required by its parent |
| `branches` | Present on union fields — each branch has its own `fields` list |
| `recursive` | `true` when cut by `recursionUnrollDepth` |
| `currentValue` | Value at this path (when `currentValue` was supplied) |
| `title`, `description`, `examples`, `enumLabels` | From explicit metadata or JSON Schema |

**Union branch grouping** — discriminated unions and `anyOf`/`oneOf` fields are never flattened into the top-level list. Branch-specific fields are isolated in `entry.branches` so an AI cannot mix fields from different variants:

```ts
const content = catalog.fields.find(f => f.pointer === "/content");
content.branches[0].discriminatorValue; // "text"
content.branches[0].fields;             // [{ pointer: "/content/body" }, …]
content.branches[1].discriminatorValue; // "binary"
content.branches[1].fields;             // [{ pointer: "/content/sizeBytes" }, …]
```

---

### `computeJsonDiff(oldValue, newValue)`

Returns a flat list of field-level differences between two JSON values. All paths are concrete — no wildcards.

```ts
import { computeJsonDiff } from "@zod-monaco/core";

const diffs = computeJsonDiff(
  { name: "Alice", age: 30 },
  { name: "Alice", age: 31, email: "alice@example.com" },
);
// [
//   { path: ["age"],   pointer: "/age",   action: "changed", oldValue: 30, newValue: 31 },
//   { path: ["email"], pointer: "/email", action: "added",   newValue: "alice@example.com" },
// ]
```

Actions: `"added"` | `"removed"` | `"changed"`.

---

### `toJsonPointer(path)` / `fromJsonPointer(pointer)`

RFC 6901 JSON Pointer utilities.

```ts
import { toJsonPointer, fromJsonPointer } from "@zod-monaco/core";

toJsonPointer(["metadata", "owner", "email"]); // "/metadata/owner/email"
toJsonPointer(["items", 0, "name"]);            // "/items/0/name"
toJsonPointer([]);                              // ""

fromJsonPointer("/a~1b/c~0d"); // ["a/b", "c~d"]  — string[], no numeric coercion
```

`fromJsonPointer` always returns `string[]`. Typed `FieldPath` values come from the catalog and resolver, not from pointer parsing.

---

### `resolveFieldMetadata(descriptor, path)`

Resolves metadata for a field at a given path, merging explicit metadata with JSON Schema-derived information (two-tier fallback).

## License

MIT
