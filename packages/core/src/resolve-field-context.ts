import type { SchemaDescriptor } from "./types.js";
import type { SchemaCache } from "./schema-cache.js";
import { resolveFieldMetadata } from "./resolve-field-metadata.js";
import { resolveJsonSchemaNode } from "./resolve-json-schema-metadata.js";
import type {
  FieldPath,
  FieldContext,
  FieldTypeInfo,
  UnionBranchSummary,
} from "./field-context-types.js";
import { toInternalPath } from "./path-utils.js";
import { isFieldReadOnly } from "./read-only.js";

/**
 * Resolves a $ref pointer without unwrapping anyOf/oneOf.
 * Used to get the raw node (preserving union wrappers) for type extraction.
 */
function resolveRefOnly(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
  seen = new Set<string>(),
): JsonSchemaNode | null {
  const ref = node.$ref;
  if (typeof ref !== "string") return node;
  if (seen.has(ref)) return null;
  seen.add(ref);
  if (ref === "#") return root;
  const match = ref.match(/^#\/(\$defs|definitions)\/(.+)$/);
  if (!match) return null;
  const defs = root[match[1] as string];
  if (!defs || typeof defs !== "object") return null;
  const resolved = (defs as JsonSchemaNode)[match[2] as string];
  if (!resolved || typeof resolved !== "object") return null;
  return resolveRefOnly(resolved as JsonSchemaNode, root, seen);
}

/**
 * Gets the raw schema node at path WITHOUT unwrapping anyOf/oneOf on the terminal node.
 * Used so extractTypeInfo can see union wrappers (nullable, discriminated unions).
 */
function resolveRawSchemaNode(
  jsonSchema: JsonSchemaNode,
  path: string[],
): JsonSchemaNode | null {
  if (path.length === 0) {
    return resolveRefOnly(jsonSchema, jsonSchema);
  }

  const parentPath = path.slice(0, -1);
  const lastSegment = path[path.length - 1]!;
  const parentNodeRaw = resolveJsonSchemaNode(
    jsonSchema as Record<string, unknown>,
    parentPath,
  ) as JsonSchemaNode | null;
  if (!parentNodeRaw) return null;

  const parentNode = mergeAllOfBranches(parentNodeRaw, jsonSchema);

  const properties = parentNode.properties as JsonSchemaNode | undefined;
  if (properties && lastSegment in properties) {
    const child = (properties as JsonSchemaNode)[lastSegment] as JsonSchemaNode;
    return resolveRefOnly(child, jsonSchema);
  }

  if (/^\d+$/.test(lastSegment)) {
    const prefixItems = parentNode.prefixItems as JsonSchemaNode[] | undefined;
    if (Array.isArray(prefixItems)) {
      const idx = parseInt(lastSegment, 10);
      if (idx < prefixItems.length) {
        return resolveRefOnly(prefixItems[idx] as JsonSchemaNode, jsonSchema);
      }
    }
    const items = parentNode.items as JsonSchemaNode | undefined;
    if (items) return resolveRefOnly(items, jsonSchema);
  }

  const additionalProperties = parentNode.additionalProperties as
    | JsonSchemaNode
    | undefined;
  if (additionalProperties && typeof additionalProperties === "object") {
    return resolveRefOnly(additionalProperties, jsonSchema);
  }

  return null;
}

type JsonSchemaNode = Record<string, unknown>;

/**
 * Merges allOf branches into a single node with combined properties and required arrays.
 * Mirrors the pattern in field-catalog.ts resolveNode().
 */
function mergeAllOfBranches(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
): JsonSchemaNode {
  const allOf = node.allOf as JsonSchemaNode[] | undefined;
  if (!Array.isArray(allOf)) return node;
  const merged: JsonSchemaNode = { ...node };
  delete merged.allOf;
  for (const branch of allOf) {
    const b = resolveRefOnly(branch, root);
    if (!b) continue;
    if (b.properties && typeof b.properties === "object") {
      merged.properties = {
        ...((merged.properties as object) ?? {}),
        ...(b.properties as object),
      };
    }
    if (Array.isArray(b.required)) {
      merged.required = [
        ...(Array.isArray(merged.required)
          ? (merged.required as unknown[])
          : []),
        ...(b.required as unknown[]),
      ];
    }
  }
  return merged;
}

/**
 * Extracts typed constraint information from a raw JSON Schema node.
 * Handles nullable detection from anyOf/oneOf null branches.
 */
function extractTypeInfo(node: JsonSchemaNode | null): FieldTypeInfo {
  if (!node) {
    return { type: undefined, nullable: false };
  }

  const info: FieldTypeInfo = {
    type: undefined,
    nullable: false,
  };

  const branches = (node.anyOf ?? node.oneOf) as JsonSchemaNode[] | undefined;
  if (Array.isArray(branches)) {
    const nonNullBranches = branches.filter((b) => b.type !== "null");
    const hasNullBranch = branches.some((b) => b.type === "null");
    info.nullable = hasNullBranch;

    if (nonNullBranches.length === 1) {
      const inner = nonNullBranches[0] as JsonSchemaNode;
      const innerInfo = extractTypeInfo(inner);
      return { ...innerInfo, nullable: true };
    }

    info.type = "union";
    info.unionBranches = nonNullBranches.map((b): UnionBranchSummary => {
      const bNode = b as JsonSchemaNode;
      const props = bNode.properties as JsonSchemaNode | undefined;
      return {
        type: typeof bNode.type === "string" ? bNode.type : undefined,
        properties: props ? Object.keys(props) : undefined,
      };
    });
    return info;
  }

  const rawType = node.type;
  if (typeof rawType === "string") {
    info.type = rawType;
  } else if (Array.isArray(rawType)) {
    const nonNull = (rawType as string[]).filter((t) => t !== "null");
    info.nullable = (rawType as string[]).includes("null");
    info.type = nonNull.length === 1 ? nonNull[0] : nonNull;
  }

  if (typeof node.format === "string") info.format = node.format;
  if (node.enum !== undefined) info.enum = node.enum as unknown[];
  if (typeof node.pattern === "string") info.pattern = node.pattern;
  if (node.const !== undefined) info.const = node.const;

  if (typeof node.minLength === "number") info.minLength = node.minLength;
  if (typeof node.maxLength === "number") info.maxLength = node.maxLength;

  if (typeof node.minimum === "number") info.minimum = node.minimum;
  if (typeof node.maximum === "number") info.maximum = node.maximum;
  if (typeof node.exclusiveMinimum === "number")
    info.exclusiveMinimum = node.exclusiveMinimum;
  if (typeof node.exclusiveMaximum === "number")
    info.exclusiveMaximum = node.exclusiveMaximum;
  if (typeof node.multipleOf === "number") info.multipleOf = node.multipleOf;

  if (typeof node.minItems === "number") info.minItems = node.minItems;
  if (typeof node.maxItems === "number") info.maxItems = node.maxItems;
  if (typeof node.uniqueItems === "boolean")
    info.uniqueItems = node.uniqueItems;

  if (node.default !== undefined) info.default = node.default;

  const props = node.properties as JsonSchemaNode | undefined;
  if (props && typeof props === "object") {
    info.properties = Object.keys(props);
  }

  return info;
}

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
