import type { FieldMetadata, FieldMetadataEntry } from "./types.js";
import { toJsonPointer } from "./path-utils.js";

/**
 * Converts a field metadata entry list into a pointer-keyed map.
 * Each entry's `path` (segment array) is converted to an RFC 6901
 * JSON Pointer string used as the map key. Entries with an empty
 * path (root) are silently skipped.
 */
export function entriesToPointerMap(
  entries: readonly FieldMetadataEntry[],
): Record<string, FieldMetadata> {
  const result: Record<string, FieldMetadata> = {};
  for (const entry of entries) {
    const pointer = toJsonPointer(entry.path as readonly string[]);
    if (pointer !== "") {
      const { path: _, ...meta } = entry;
      result[pointer] = meta;
    }
  }
  return result;
}
