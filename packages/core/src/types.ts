import type { ZodType, ZodSafeParseResult } from "zod";

export interface FieldMetadata {
  title?: string;
  description?: string;
  examples?: unknown[];
  placeholder?: string;
  enumLabels?: Record<string, string>;
  emptyStateHint?: string;
}

export type SchemaMetadata<K extends string = string> = FieldMetadata & {
  fields?: Partial<Record<K, FieldMetadata>>;
};

export type ResolvedMetadata<K extends string = string> = FieldMetadata & {
  fields: Partial<Record<K, FieldMetadata>>;
};

// --- Descriptor ---

export interface SchemaDescriptor<T = unknown> {
  /** JSON Schema object generated from the Zod v4 schema */
  jsonSchema: Record<string, unknown>;
  /** Wraps schema.safeParse() — returns Zod's native ZodSafeParseResult */
  validate: (json: unknown) => ZodSafeParseResult<T>;
  /** Resolved metadata with guaranteed fields record */
  metadata: ResolvedMetadata<
    T extends Record<string, unknown>
      ? Extract<keyof T, string> | (string & {})
      : string
  >;
  /** Original Zod schema reference for advanced consumers */
  schema: ZodType;
}
