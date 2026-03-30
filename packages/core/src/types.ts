import type { ZodType, ZodSafeParseResult } from "zod";

export interface FieldMetadata {
  title?: string;
  description?: string;
  examples?: unknown[];
  placeholder?: string;
  enumLabels?: Record<string, string>;
  emptyStateHint?: string;
}

/** Recursive dot-notation path union, depth-capped at 10. */
export type DeepPaths<T, D extends number[] = []> =
  D["length"] extends 10
    ? never
    : T extends readonly (infer E)[]
      ? DeepPaths<E, [...D, 0]>
      : T extends Record<string, unknown>
        ? {
            [K in Extract<keyof T, string>]:
              | K
              | `${K}.${DeepPaths<NonNullable<T[K]>, [...D, 0]>}`;
          }[Extract<keyof T, string>]
        : never;

/** Nested object input — `_meta` for self-metadata, named keys for children. */
export type NestedFieldMetadataNode<T, D extends number[] = []> =
  D["length"] extends 10
    ? FieldMetadata
    : T extends readonly (infer E)[]
      ? { _meta?: FieldMetadata } & NestedFieldMetadataNode<E, [...D, 0]>
      : T extends Record<string, unknown>
        ? { _meta?: FieldMetadata } & {
            [K in Extract<keyof T, string>]?: NonNullable<
              T[K]
            > extends Record<string, unknown>
              ? NestedFieldMetadataNode<NonNullable<T[K]>, [...D, 0]>
              : FieldMetadata;
          }
        : FieldMetadata;

/** Accepts flat dot-notation record OR nested object with `_meta`. */
export type FieldsInput<T> =
  | Partial<Record<DeepPaths<T> | (string & {}), FieldMetadata>>
  | NestedFieldMetadataNode<T>;

export type SchemaMetadata<T = unknown> = FieldMetadata & {
  fields?: FieldsInput<T>;
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
