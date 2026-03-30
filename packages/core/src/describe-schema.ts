import { toJSONSchema, type ZodType } from "zod";
import type {
  SchemaMetadata,
  SchemaDescriptor,
  FieldMetadata,
  ResolvedMetadata,
} from "./types.js";
import { ToJSONSchemaParams } from "zod/v4/core";
import { normalizeFieldsInput } from "./flatten-fields.js";

function resolveMetadata(
  input?: SchemaMetadata<unknown>,
): ResolvedMetadata {
  if (!input) {
    return { fields: {} };
  }

  const { fields, ...rest } = input;
  const flatFields = fields
    ? normalizeFieldsInput(fields as Record<string, unknown>)
    : {};

  return { ...rest, fields: flatFields as Partial<Record<string, FieldMetadata>> };
}

export function describeSchema<T>(
  schema: ZodType<T>,
  options?: {
    metadata?: SchemaMetadata<T>;
    toJsonSchemaOptions?: ToJSONSchemaParams;
  },
): SchemaDescriptor<T> {
  const jsonSchema = toJSONSchema(
    schema,
    options?.toJsonSchemaOptions,
  ) as Record<string, unknown>;
  const validate = (json: unknown) => schema.safeParse(json);
  // SchemaMetadata<T> is structurally wider than SchemaMetadata<unknown>
  // due to NestedFieldMetadataNode variance, but at runtime both are
  // plain objects — the cast is safe because normalizeFieldsInput handles
  // any shape.
  const metadata = resolveMetadata(
    options?.metadata as SchemaMetadata<unknown> | undefined,
  );

  return { jsonSchema, validate, metadata, schema };
}
