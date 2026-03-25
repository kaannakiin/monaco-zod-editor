import type { FieldPath } from "./field-context-types.js";
import { toJsonPointer } from "./path-utils.js";

// ─── Public types ─────────────────────────────────────────────────────────────

export type DiffAction = "added" | "removed" | "changed";

export interface FieldDiff {
  path: FieldPath;
  /** RFC 6901 JSON Pointer — always concrete (diff walks real values, never wildcards). */
  pointer: string;
  action: DiffAction;
  oldValue?: unknown;
  newValue?: unknown;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isArray(v: unknown): v is unknown[] {
  return Array.isArray(v);
}

function isPrimitive(v: unknown): boolean {
  return !isObject(v) && !isArray(v);
}

/**
 * Recursively diff two values, collecting FieldDiff entries.
 */
function diffValues(
  oldVal: unknown,
  newVal: unknown,
  path: FieldPath,
  out: FieldDiff[],
): void {
  // Both objects — recurse into properties
  if (isObject(oldVal) && isObject(newVal)) {
    const allKeys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
    for (const key of allKeys) {
      const childPath: FieldPath = [...path, key];
      if (!(key in newVal)) {
        out.push({ path: childPath, pointer: toJsonPointer(childPath), action: "removed", oldValue: oldVal[key] });
      } else if (!(key in oldVal)) {
        out.push({ path: childPath, pointer: toJsonPointer(childPath), action: "added", newValue: newVal[key] });
      } else {
        diffValues(oldVal[key], newVal[key], childPath, out);
      }
    }
    return;
  }

  // Both arrays — diff by index
  if (isArray(oldVal) && isArray(newVal)) {
    const maxLen = Math.max(oldVal.length, newVal.length);
    for (let i = 0; i < maxLen; i++) {
      const childPath: FieldPath = [...path, i];
      if (i >= newVal.length) {
        out.push({ path: childPath, pointer: toJsonPointer(childPath), action: "removed", oldValue: oldVal[i] });
      } else if (i >= oldVal.length) {
        out.push({ path: childPath, pointer: toJsonPointer(childPath), action: "added", newValue: newVal[i] });
      } else {
        diffValues(oldVal[i], newVal[i], childPath, out);
      }
    }
    return;
  }

  // Type mismatch or primitive change
  if (oldVal !== newVal) {
    out.push({
      path,
      pointer: toJsonPointer(path),
      action: "changed",
      oldValue: oldVal,
      newValue: newVal,
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Computes a flat list of field-level differences between two JSON values.
 *
 * - Walks objects recursively, reporting added/removed/changed leaves.
 * - Arrays are diffed by index.
 * - Returns an empty array when the values are deeply equal.
 * - All paths are concrete — no wildcards.
 */
export function computeJsonDiff(
  oldValue: unknown,
  newValue: unknown,
): FieldDiff[] {
  const out: FieldDiff[] = [];
  diffValues(oldValue, newValue, [], out);
  return out;
}
