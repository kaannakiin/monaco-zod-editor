import type { ZodType, ZodSafeParseResult } from "zod";

export interface FieldMetadata {
  title?: string;
  description?: string;
  examples?: unknown[];
  placeholder?: string;
  enumLabels?: Record<string, string>;
  emptyStateHint?: string;
}

/**
 * Type-safe segment-array path union for schema-level targeting.
 * Arrays are traversed into their element type (no numeric indices).
 * Depth-capped at 8 to keep TypeScript happy with recursive schemas.
 */
export type SchemaPath<T, D extends number[] = []> =
  D["length"] extends 8
    ? never
    : T extends readonly (infer E)[]
      ? SchemaPath<E, [...D, 0]>
      : T extends Record<string, unknown>
        ? {
            [K in Extract<keyof T, string>]:
              | readonly [K]
              | readonly [K, ...SchemaPath<NonNullable<T[K]>, [...D, 0]>];
          }[Extract<keyof T, string>]
        : never;

/** A single field metadata entry with a type-safe segment-array path. */
export type FieldMetadataEntry<T = unknown> = FieldMetadata & {
  path: SchemaPath<T> extends never ? readonly string[] : SchemaPath<T>;
};

export type SchemaMetadata<T = unknown> = FieldMetadata & {
  fields?: readonly FieldMetadataEntry<T>[];
};

/** Runtime enum constraint injected into a JSON Schema node. */
export type EnumRefinement<T = unknown> = {
  path: SchemaPath<T> extends never ? readonly string[] : SchemaPath<T>;
  enum: readonly string[];
  labels?: Record<string, string>;
};

/** Runtime suggestion refinement for free-text fields. Soft completions only — no validation. */
export type SuggestionRefinement<T = unknown> = {
  path: SchemaPath<T> extends never ? readonly string[] : SchemaPath<T>;
  suggestions: readonly string[];
  /**
   * Optional regex pattern. When present, suggestions only appear if the text
   * before the cursor matches this pattern.
   * Example: "\\{" triggers suggestions when user types `{`.
   */
  triggerPattern?: string;
};

export type ResolvedMetadata<K extends string = string> = FieldMetadata & {
  fields: Partial<Record<K, FieldMetadata>>;
};

export interface SchemaDescriptor<T = unknown> {
  jsonSchema: Record<string, unknown>;
  validate: (json: unknown) => ZodSafeParseResult<T>;
  metadata: ResolvedMetadata;
  schema: ZodType;
}
