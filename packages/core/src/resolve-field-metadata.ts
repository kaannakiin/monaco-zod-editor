import type { FieldMetadata, ResolvedMetadata } from "./types.js";
import { resolveJsonSchemaMetadata } from "./resolve-json-schema-metadata.js";
import { toJsonPointer, fromJsonPointer } from "./path-utils.js";
import type { SchemaCache } from "./schema-cache.js";

/** Pre-computed suffix index entry. */
interface SuffixEntry {
  segments: string[];
  meta: FieldMetadata;
}

/** Cached suffix index keyed by the `fields` object identity. */
const suffixIndexCache = new WeakMap<object, Map<string, SuffixEntry[]>>();

/**
 * Builds (or retrieves cached) suffix index for metadata fields.
 * Groups entries by their last segment for O(1) amortized lookup.
 */
function getSuffixIndex(
  fields: Partial<Record<string, FieldMetadata>>,
): Map<string, SuffixEntry[]> {
  let index = suffixIndexCache.get(fields as object);
  if (index) return index;

  index = new Map<string, SuffixEntry[]>();
  for (const [pointer, meta] of Object.entries(fields)) {
    if (!meta) continue;
    const segments = fromJsonPointer(pointer);
    if (segments.length === 0) continue;
    const lastSeg = segments[segments.length - 1]!;
    let bucket = index.get(lastSeg);
    if (!bucket) {
      bucket = [];
      index.set(lastSeg, bucket);
    }
    bucket.push({ segments, meta });
  }
  suffixIndexCache.set(fields as object, index);
  return index;
}

/**
 * Finds explicit metadata for a runtime path by suffix-matching against
 * metadata entries. Uses a pre-computed index keyed by last segment
 * for O(1) amortized lookup instead of O(N) linear scan.
 */
function findRecursiveMatch(
  fields: Partial<Record<string, FieldMetadata>>,
  path: (string | number)[],
): FieldMetadata | undefined {
  const stripped = path.filter(
    (s): s is string => typeof s === "string" && !/^\d+$/.test(s),
  );
  if (stripped.length === 0) return undefined;

  const index = getSuffixIndex(fields);
  const lastSeg = stripped[stripped.length - 1]!;
  const bucket = index.get(lastSeg);
  if (!bucket) return undefined;

  let bestMatch: FieldMetadata | undefined;
  let bestLength = 0;

  for (const { segments: entrySegments, meta } of bucket) {
    if (entrySegments.length > stripped.length) continue;

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
