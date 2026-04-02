# @zod-monaco/core

Zod v4 runtime bridge for JSON Schema generation, field resolution, enum refinements, and AI-ready field catalog.

## Installation

```bash
npm install @zod-monaco/core zod
```

## Quick Start

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
    fields: [
      { path: ["name"], title: "Name", description: "Full name" },
      { path: ["age"], title: "Age", placeholder: "25" },
    ],
  },
});

// descriptor.jsonSchema  — JSON Schema object
// descriptor.validate    — (json: unknown) => ZodSafeParseResult
// descriptor.metadata    — resolved field metadata
```

## Enum Refinements

Inject dynamic enum values into a field without rebuilding the schema:

```ts
const descriptor = describeSchema(schema, {
  metadata,
  refinements: [
    {
      path: ["status"],
      enum: ["active", "inactive", "pending"],
      labels: {
        active: "Active",
        inactive: "Inactive",
        pending: "Pending",
      },
    },
  ],
});
```

`refinements` are applied to the JSON Schema for completion and hover, and also enforced at runtime by `descriptor.validate()`. Invalid values produce a Zod-compatible `invalid_value` issue.

Arrays are handled automatically — if the target field is inside an array, all array items are validated and issues carry the correct runtime indices:

```ts
// schema path:  ["items", "status"]
// runtime issue path for invalid third item: ["items", 2, "status"]
```

Empty `enum` arrays are silently ignored (no-op). Targeting an object or array node throws.

---

## Recommended Ergonomics

`refinements` is a low-level primitive. For real-world use, a helper that derives refinements from your domain data keeps call sites clean:

```ts
const runtimeConfig = buildMyRefinements(dtoOptions);

const descriptor = describeSchema(schema, {
  metadata,
  refinements: runtimeConfig.schema,
});

attachZodToEditor({
  monaco,
  editor,
  descriptor,
  refinements: runtimeConfig.editor,
});
```

The refinements data can come from any backend-agnostic source — DTO, OpenAPI, GraphQL, CMS, Prisma, feature flags, or tenant config. The schema stays fixed; field behavior is injected at runtime.

---

## API

### `describeSchema(schema, options?)`

Creates a `SchemaDescriptor` from a Zod v4 schema.

- `schema` — any Zod v4 schema
- `options.metadata` — optional schema and field-level metadata
- `options.refinements` — optional `EnumRefinement<T>[]` for dynamic enum injection
- `options.toJsonSchemaOptions` — options passed to Zod's `toJSONSchema()`

The returned `descriptor.validate` runs Zod validation followed by an enum refinement pass. Both issue sets are merged into a single `ZodSafeParseResult`.

---

### `resolveFieldContext(descriptor, path, cache?)`

Resolves the full context for a field — type info, metadata, and required status — in a single call. Used internally by hover, completions, and the catalog builder.

```ts
import { resolveFieldContext } from "@zod-monaco/core";

const ctx = resolveFieldContext(descriptor, ["owner", "email"]);
ctx.typeInfo.type;       // "string"
ctx.typeInfo.format;     // "email"
ctx.typeInfo.nullable;   // false
ctx.metadata?.title;     // "Owner's email address"
ctx.metadata?.constraints?.maxLength; // 255 (auto-populated from schema)
ctx.required;            // true
ctx.readOnly;            // false
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

### `matchesSchemaPath(runtimePath, schemaPath)`

Tests whether a runtime `FieldPath` matches a schema-level path. Numeric array indices in the runtime path are skipped — only string segments are compared:

```ts
import { matchesSchemaPath } from "@zod-monaco/core";

matchesSchemaPath(["items", 0, "status"], ["items", "status"]); // true
matchesSchemaPath(["items", 2, "status"], ["items", "status"]); // true
matchesSchemaPath(["name"], ["items", "status"]);               // false
```

Used by the completions provider to match suggestion refinements against the cursor path.

---

### `toJsonPointer(path)` / `fromJsonPointer(pointer)`

RFC 6901 JSON Pointer utilities.

```ts
import { toJsonPointer, fromJsonPointer } from "@zod-monaco/core";

toJsonPointer(["owner", "email"]);   // "/owner/email"
toJsonPointer(["items", 0, "name"]); // "/items/0/name"
toJsonPointer([]);                   // ""

fromJsonPointer("/a~1b/c~0d"); // ["a/b", "c~d"]  — string[], no numeric coercion
```

`fromJsonPointer` always returns `string[]`. Typed `FieldPath` values come from the catalog and resolver, not from pointer parsing.

---

### `resolveFieldMetadata(descriptor, path)`

Resolves metadata for a field at a given path, merging explicit metadata with JSON Schema-derived information (two-tier fallback).

---

### `applyEnumRefinements(jsonSchema, refinements)`

Low-level utility that mutates a JSON Schema object in place, injecting `enum` and `x-enumLabels` for each refinement. Called internally by `describeSchema`. Use directly if you manage your own JSON Schema pipeline.

---

## Types

### `SchemaPath<T>`

Type-safe segment array for targeting a field in a schema. Provides IDE autocomplete and compile-time path validation. Depth-capped at 8 levels.

```ts
import type { SchemaPath } from "@zod-monaco/core";

type MySchema = { user: { address: { city: string } } };
type P = SchemaPath<MySchema>; // ["user"] | ["user", "address"] | ["user", "address", "city"]
```

### `EnumRefinement<T>`

```ts
type EnumRefinement<T> = {
  path: SchemaPath<T>;
  enum: readonly string[];
  labels?: Record<string, string>;
};
```

### `FieldMetadataEntry<T>`

```ts
type FieldMetadataEntry<T> = {
  path: SchemaPath<T>;
  title?: string;
  description?: string;
  examples?: readonly unknown[];
  placeholder?: string;
  enumLabels?: Record<string, string>;
  emptyStateHint?: string;
  readOnly?: boolean;
  constraints?: FieldConstraints; // auto-populated from schema (min/max, pattern, etc.)
};
```

### `FieldConstraints`

Schema-derived validation constraints, automatically populated by `resolveFieldContext`:

```ts
interface FieldConstraints {
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  pattern?: string;
  multipleOf?: number;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  default?: unknown;
}
```

## License

MIT
