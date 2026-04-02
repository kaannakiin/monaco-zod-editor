import { toJSONSchema, ZodError, type ZodSafeParseResult, type ZodType } from "zod";
import type {
  SchemaMetadata,
  SchemaDescriptor,
  FieldMetadata,
  ResolvedMetadata,
  EnumRefinement,
} from "./types.js";
import { ToJSONSchemaParams } from "zod/v4/core";
import { entriesToPointerMap } from "./flatten-fields.js";
import { applyEnumRefinements, validateEnumRefinements } from "./apply-refinements.js";
import { toJsonPointer } from "./path-utils.js";

function resolveMetadata(
  input?: SchemaMetadata<unknown>,
): ResolvedMetadata {
  if (!input) {
    return { fields: {} };
  }

  const { fields, ...rest } = input;
  const flatFields = fields ? entriesToPointerMap(fields) : {};

  const readOnlyPaths = new Set<string>();
  if (fields) {
    for (const entry of fields) {
      if (entry.readOnly) {
        const pointer = toJsonPointer(entry.path as readonly string[]);
        if (pointer !== "") readOnlyPaths.add(pointer);
      }
    }
  }

  return {
    ...rest,
    fields: flatFields as Partial<Record<string, FieldMetadata>>,
    ...(readOnlyPaths.size > 0 ? { readOnlyPaths } : {}),
  };
}

export function describeSchema<T>(
  schema: ZodType<T>,
  options?: {
    metadata?: SchemaMetadata<T>;
    refinements?: readonly EnumRefinement<T>[];
    toJsonSchemaOptions?: ToJSONSchemaParams;
  },
): SchemaDescriptor<T> {
  const jsonSchema = toJSONSchema(
    schema,
    options?.toJsonSchemaOptions,
  ) as Record<string, unknown>;

  if (options?.refinements?.length) {
    applyEnumRefinements(
      jsonSchema,
      options.refinements as readonly {
        path: readonly string[];
        enum: readonly string[];
        labels?: Record<string, string>;
      }[],
    );
  }

  const normalizedRefinements = options?.refinements as
    | readonly { path: readonly string[]; enum: readonly string[] }[]
    | undefined;

  const validate = (json: unknown): ZodSafeParseResult<T> => {
    const result = schema.safeParse(json);

    if (!normalizedRefinements?.length) return result;

    const refinementIssues = validateEnumRefinements(json, normalizedRefinements);
    if (refinementIssues.length === 0) return result;

    if (result.success) {
      return {
        success: false,
        error: new ZodError(refinementIssues),
      } as ZodSafeParseResult<T>;
    } else {
      result.error.issues.push(...refinementIssues);
      return result;
    }
  };
  const metadata = resolveMetadata(
    options?.metadata as SchemaMetadata<unknown> | undefined,
  );

  return { jsonSchema, validate, metadata, schema };
}
