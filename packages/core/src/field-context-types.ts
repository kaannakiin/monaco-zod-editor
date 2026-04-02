import type { FieldMetadata } from "./types.js";

/** Type-safe path segment — string for object keys, number for array indices */
export type FieldSegment = string | number;

/** Ordered path segments to a field */
export type FieldPath = ReadonlyArray<FieldSegment>;

/** Extracted type constraints from a JSON Schema node */
export interface FieldTypeInfo {
  type: string | string[] | undefined;
  nullable: boolean;
  format?: string;
  enum?: unknown[];
  pattern?: string;
  const?: unknown;

  minLength?: number;
  maxLength?: number;

  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  default?: unknown;

  properties?: string[];

  unionBranches?: UnionBranchSummary[];
}

/** Summary of a single union branch for use in FieldTypeInfo */
export interface UnionBranchSummary {
  discriminatorKey?: string;
  discriminatorValue?: unknown;
  type?: string;
  properties?: string[];
}

/**
 * Internal runtime type — used by hover, completion providers, and the catalog builder.
 * Contains the raw schemaNode which MUST NOT be serialized to transport/AI payloads.
 */
export interface FieldContext {
  path: FieldPath;
  metadata: FieldMetadata | undefined;
  /** Raw JSON Schema node — for internal use only, do not serialize */
  schemaNode: Record<string, unknown> | null;
  typeInfo: FieldTypeInfo;
  required: boolean;
  readOnly: boolean;
}
