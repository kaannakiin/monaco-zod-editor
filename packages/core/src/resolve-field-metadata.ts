import type { FieldMetadata, ResolvedMetadata } from "./types.js";
import { resolveJsonSchemaMetadata } from "./resolve-json-schema-metadata.js";

/**
 * Resolves metadata for a field path using a two-tier fallback:
 * 1. Explicit metadata from `metadata.fields` (dot-notation keys)
 * 2. JSON Schema title/description/examples (from Zod `.describe()` / `.meta()`)
 *
 * When both exist, explicit metadata fields override JSON Schema fallback.
 */
export function resolveFieldMetadata(
  metadata: ResolvedMetadata,
  path: string[],
  jsonSchema?: Record<string, unknown>,
): FieldMetadata | undefined {
  if (path.length === 0) {
    const { fields, ...topLevel } = metadata;
    return Object.keys(topLevel).length > 0 ? topLevel : undefined;
  }

  const explicit = metadata.fields[path.join(".")];
  const schemaFallback = jsonSchema
    ? resolveJsonSchemaMetadata(jsonSchema, path)
    : undefined;

  if (explicit && schemaFallback) {
    // Merge: explicit wins, fallback fills gaps
    const merged: FieldMetadata = { ...schemaFallback };
    for (const [key, value] of Object.entries(explicit)) {
      if (value !== undefined) {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
    return merged;
  }

  return explicit ?? schemaFallback;
}
