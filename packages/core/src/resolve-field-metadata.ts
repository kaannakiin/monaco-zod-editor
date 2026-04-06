import type { FieldMetadata, ResolvedMetadata } from "./types.js";
import { resolveJsonSchemaMetadata } from "./resolve-json-schema-metadata.js";
import { toJsonPointer, fromJsonPointer } from "./path-utils.js";
import type { SchemaCache } from "./schema-cache.js";

/**
 * Finds explicit metadata for a runtime path by suffix-matching against
 * metadata entries. Numeric (array index) segments are stripped from the
 * runtime path before comparison, then each entry's path is tested as a
 * suffix of the stripped path. The longest (most specific) match wins.
 *
 * This enables recursive schemas to reuse metadata definitions:
 * e.g. metadata for `["Children"]` also applies to
 * `["Children", 0, "Children", 0]` at any nesting depth.
 */
function findRecursiveMatch(
  fields: Partial<Record<string, FieldMetadata>>,
  path: (string | number)[],
): FieldMetadata | undefined {
  const stripped = path.filter(
    (s): s is string => typeof s === "string" && !/^\d+$/.test(s),
  );
  if (stripped.length === 0) return undefined;

  let bestMatch: FieldMetadata | undefined;
  let bestLength = 0;

  for (const [pointer, meta] of Object.entries(fields)) {
    const entrySegments = fromJsonPointer(pointer);
    if (entrySegments.length === 0 || entrySegments.length > stripped.length) continue;

    const offset = stripped.length - entrySegments.length;
    let matches = true;
    for (let i = 0; i < entrySegments.length; i++) {
      if (entrySegments[i] !== stripped[offset + i]) {
        matches = false;
        break;
      }
    }

    if (matches && entrySegments.length > bestLength) {
      bestLength = entrySegments.length;
      bestMatch = meta;
    }
  }

  return bestMatch;
}

/**
 * Resolves metadata for a field path using a two-tier fallback:
 * 1. Explicit metadata from `metadata.fields` (JSON Pointer keys)
 * 2. JSON Schema title/description/examples (from Zod `.describe()` / `.meta()`)
 *
 * When both exist, explicit metadata fields override JSON Schema fallback.
 * Pass an optional `cache` to avoid repeated schema traversals.
 */
export function resolveFieldMetadata(
  metadata: ResolvedMetadata,
  path: string[],
  jsonSchema?: Record<string, unknown>,
  cache?: SchemaCache,
): FieldMetadata | undefined {
  if (path.length === 0) {
    const { fields, ...topLevel } = metadata;
    return Object.keys(topLevel).length > 0 ? topLevel : undefined;
  }

  const explicit = metadata.fields[toJsonPointer(path)]
    ?? findRecursiveMatch(metadata.fields, path);
  const schemaFallback = cache
    ? cache.resolveMetadata(path)
    : jsonSchema
      ? resolveJsonSchemaMetadata(jsonSchema, path)
      : undefined;

  if (explicit && schemaFallback) {
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
