import type { SchemaDescriptor } from "./types.js";
import type { SchemaCache } from "./schema-cache.js";
import { resolveFieldMetadata } from "./resolve-field-metadata.js";
import { resolveJsonSchemaNode } from "./resolve-json-schema-metadata.js";
import type {
  FieldPath,
  FieldContext,
} from "./field-context-types.js";
import { toInternalPath } from "./path-utils.js";
import { isFieldReadOnly } from "./read-only.js";
import {
  extractTypeInfo,
  resolveRawSchemaNode,
  mergeAllOfBranches,
} from "./extract-type-info.js";

type JsonSchemaNode = Record<string, unknown>;

/**
 * Resolves the full field context for a given path — the shared abstraction
 * used by hover providers, completion providers, and the field catalog builder.
 *
 * This is the single bridge point between the new FieldPath API and the
 * legacy string[] internal APIs (resolveFieldMetadata, resolveJsonSchemaNode,
 * SchemaCache). The FieldPath → string[] conversion happens ONLY here.
 */
export function resolveFieldContext(
  descriptor: SchemaDescriptor,
  path: FieldPath,
  cache?: SchemaCache,
): FieldContext {
  if (cache) {
    return cache.resolveContext(path, () => resolveFieldContextUncached(descriptor, path, cache));
  }
  return resolveFieldContextUncached(descriptor, path, cache);
}

function resolveFieldContextUncached(
  descriptor: SchemaDescriptor,
  path: FieldPath,
  cache?: SchemaCache,
): FieldContext {
  const internalPath = toInternalPath(path);

  const schemaNode = cache
    ? cache.resolveNode(internalPath)
    : resolveJsonSchemaNode(descriptor.jsonSchema, internalPath);

  const rawNode = resolveRawSchemaNode(
    descriptor.jsonSchema as JsonSchemaNode,
    internalPath,
  );

  const metadata = resolveFieldMetadata(
    descriptor.metadata,
    internalPath,
    descriptor.jsonSchema,
    cache,
  );

  let required = false;
  const lastSegment = path.at(-1);
  if (typeof lastSegment === "string" && path.length > 0) {
    const parentInternalPath = internalPath.slice(0, -1);
    const parentNodeRaw2 = cache
      ? cache.resolveNode(parentInternalPath)
      : resolveJsonSchemaNode(descriptor.jsonSchema, parentInternalPath);
    const parentNodeMerged = parentNodeRaw2
      ? mergeAllOfBranches(
          parentNodeRaw2 as JsonSchemaNode,
          descriptor.jsonSchema as JsonSchemaNode,
        )
      : null;
    const requiredArray = parentNodeMerged?.required;
    if (Array.isArray(requiredArray)) {
      required = requiredArray.includes(lastSegment);
    }
  }

  const typeInfo = extractTypeInfo(rawNode);

  const enrichedMetadata = metadata ? { ...metadata } : undefined;
  if (enrichedMetadata && typeInfo) {
    const c: Record<string, unknown> = {};
    if (typeInfo.minLength !== undefined) c.minLength = typeInfo.minLength;
    if (typeInfo.maxLength !== undefined) c.maxLength = typeInfo.maxLength;
    if (typeInfo.minimum !== undefined) c.minimum = typeInfo.minimum;
    if (typeInfo.maximum !== undefined) c.maximum = typeInfo.maximum;
    if (typeInfo.exclusiveMinimum !== undefined) c.exclusiveMinimum = typeInfo.exclusiveMinimum;
    if (typeInfo.exclusiveMaximum !== undefined) c.exclusiveMaximum = typeInfo.exclusiveMaximum;
    if (typeInfo.pattern !== undefined) c.pattern = typeInfo.pattern;
    if (typeInfo.multipleOf !== undefined) c.multipleOf = typeInfo.multipleOf;
    if (typeInfo.minItems !== undefined) c.minItems = typeInfo.minItems;
    if (typeInfo.maxItems !== undefined) c.maxItems = typeInfo.maxItems;
    if (typeInfo.uniqueItems !== undefined) c.uniqueItems = typeInfo.uniqueItems;
    if (typeInfo.default !== undefined) c.default = typeInfo.default;
    if (Object.keys(c).length > 0) {
      enrichedMetadata.constraints = c as import("./types.js").FieldConstraints;
    }
  }

  return {
    path,
    metadata: enrichedMetadata,
    schemaNode,
    typeInfo,
    required,
    readOnly: isFieldReadOnly(descriptor.metadata, path),
  };
}
