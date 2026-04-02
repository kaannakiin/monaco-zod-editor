import type { FieldPath } from "./field-context-types.js";
import type { ResolvedMetadata } from "./types.js";
import { toJsonPointer } from "./path-utils.js";

/**
 * Returns true if diffPath is a prefix of any locked path.
 * Handles the ancestor-replace scenario where a type mismatch causes
 * computeJsonDiff to emit a parent path instead of per-field paths.
 */
export function diffPathCoversReadOnlyDescendant(
  diffPath: FieldPath,
  readOnlyPaths: ReadonlySet<string>,
): boolean {
  const segments = diffPath.filter((s): s is string => typeof s === "string");
  const prefix = toJsonPointer(segments);
  for (const p of readOnlyPaths) {
    if (p === prefix || p.startsWith(prefix + "/")) return true;
  }
  return false;
}

/**
 * Determines whether a field path is read-only.
 *
 * A field is read-only when:
 * 1. Root-level metadata has `readOnly: true` (entire document locked), OR
 * 2. The field itself has `readOnly: true` in its metadata, OR
 * 3. Any ancestor path has `readOnly: true` (lock propagation)
 *
 * Numeric segments (array indices) are skipped for schema-path matching:
 * if `/items` is locked, `/items/0`, `/items/1`, etc. are all locked.
 */
export function isFieldReadOnly(
  metadata: ResolvedMetadata,
  path: FieldPath,
): boolean {
  if (metadata.readOnly) return true;
  if (!metadata.readOnlyPaths || metadata.readOnlyPaths.size === 0) return false;

  const segments: string[] = [];
  for (const seg of path) {
    if (typeof seg === "number") continue;
    segments.push(seg);
  }

  for (let i = 1; i <= segments.length; i++) {
    const pointer = toJsonPointer(segments.slice(0, i));
    if (metadata.readOnlyPaths.has(pointer)) return true;
  }

  return false;
}
