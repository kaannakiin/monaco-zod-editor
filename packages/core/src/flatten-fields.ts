import type { FieldMetadata } from "./types.js";

const FIELD_METADATA_KEYS = new Set([
  "title",
  "description",
  "examples",
  "placeholder",
  "enumLabels",
  "emptyStateHint",
]);

function isFieldMetadata(value: unknown): value is FieldMetadata {
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value);
  return keys.length > 0 && keys.every((k) => FIELD_METADATA_KEYS.has(k));
}

function isNestedFormat(fields: Record<string, unknown>): boolean {
  return Object.entries(fields).some(([key, v]) => {
    if (key === "_meta") return true;
    if (typeof v !== "object" || v === null) return false;
    return "_meta" in v || !isFieldMetadata(v);
  });
}

function flattenNestedFields(
  nested: Record<string, unknown>,
  prefix: string = "",
): Record<string, FieldMetadata> {
  const result: Record<string, FieldMetadata> = {};

  for (const [key, value] of Object.entries(nested)) {
    if (key === "_meta") {
      if (prefix && isFieldMetadata(value)) {
        result[prefix] = value;
      }
      continue;
    }

    const fullPath = prefix ? `${prefix}.${key}` : key;

    if (typeof value !== "object" || value === null) continue;

    if (isFieldMetadata(value)) {
      result[fullPath] = value;
    } else {
      Object.assign(
        result,
        flattenNestedFields(value as Record<string, unknown>, fullPath),
      );
    }
  }

  return result;
}

/**
 * Normalizes field metadata input (flat or nested) into a flat
 * `Record<string, FieldMetadata>` keyed by dot-notation paths.
 */
export function normalizeFieldsInput(
  fields: Record<string, unknown>,
): Record<string, FieldMetadata> {
  if (isNestedFormat(fields)) {
    return flattenNestedFields(fields);
  }
  return fields as Record<string, FieldMetadata>;
}
