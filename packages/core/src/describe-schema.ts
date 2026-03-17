import { toJSONSchema, type ZodType } from "zod";
import type {
  SchemaMetadata,
  SchemaDescriptor,
  FieldMetadata,
} from "./types.js";
import { ToJSONSchemaParams } from "zod/v4/core";

type InferFieldKeys<T> = T extends Record<string, unknown>
  ? Extract<keyof T, string> | (string & {})
  : string;

function resolveMetadata<K extends string = string>(
  input?: SchemaMetadata<K>,
): { fields: Partial<Record<K, FieldMetadata>> } & FieldMetadata {
  if (!input) {
    return { fields: {} as Partial<Record<K, FieldMetadata>> };
  }

  const { fields, ...rest } = input;
  return { ...rest, fields: (fields ?? {}) as Partial<Record<K, FieldMetadata>> };
}

export function describeSchema<T>(
  schema: ZodType<T>,
  options?: {
    metadata?: SchemaMetadata<InferFieldKeys<T>>;
    toJsonSchemaOptions?: ToJSONSchemaParams;
  },
): SchemaDescriptor<T> {
  const jsonSchema = toJSONSchema(
    schema,
    options?.toJsonSchemaOptions,
  ) as Record<string, unknown>;
  const validate = (json: unknown) => schema.safeParse(json);
  const metadata = resolveMetadata(options?.metadata);

  return { jsonSchema, validate, metadata, schema };
}
