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

export interface SchemaDescriptor<T = unknown> {
  jsonSchema: Record<string, unknown>;
  validate: (json: unknown) => ZodSafeParseResult<T>;
  metadata: ResolvedMetadata<
    T extends Record<string, unknown>
      ? Extract<keyof T, string> | (string & {})
      : string
  >;
  schema: ZodType;
}
