import type { FieldPath } from "./field-context-types.js";

/**
 * Converts a typed FieldPath to a RFC 6901 JSON Pointer string.
 * e.g. ["foo", "bar", 0] → "/foo/bar/0"
 * e.g. [] → ""
 */
export function toJsonPointer(path: FieldPath): string {
  if (path.length === 0) return "";
  return (
    "/" +
    path
      .map((s) => String(s).replace(/~/g, "~0").replace(/\//g, "~1"))
      .join("/")
  );
}

/**
 * Parses a RFC 6901 JSON Pointer back to string segments.
 *
 * IMPORTANT: Does NOT coerce numeric-looking segments to number.
 * "/foo/0" returns ["foo", "0"], not ["foo", 0].
 *
 * Canonical FieldPath (with typed number segments) must come from the
 * schema/catalog, not from pointer parsing — because a JSON Pointer alone
 * cannot distinguish array index 0 from object key "0".
 */
export function fromJsonPointer(pointer: string): string[] {
  if (pointer === "") return [];
  return pointer
    .slice(1)
    .split("/")
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/**
 * Converts a FieldPath to the string[] format expected by legacy internal APIs
 * (resolveFieldMetadata, resolveJsonSchemaNode, SchemaCache).
 * All segments are stringified — numeric indices become "0", "1", etc.
 */
export function toInternalPath(path: FieldPath): string[] {
  return path.map(String);
}
