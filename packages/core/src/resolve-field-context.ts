import type { SchemaDescriptor } from "./types.js";
import type { SchemaCache } from "./schema-cache.js";
import {
  resolveFieldMetadata,
} from "./resolve-field-metadata.js";
import {
  resolveJsonSchemaNode,
} from "./resolve-json-schema-metadata.js";
import type {
  FieldPath,
  FieldContext,
  FieldTypeInfo,
  UnionBranchSummary,
} from "./field-context-types.js";
import { toInternalPath } from "./path-utils.js";

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
  // Navigate to parent via the existing traversal (which DOES unwrap unions for navigation)
  const parentPath = path.slice(0, -1);
  const lastSegment = path[path.length - 1]!;
  const parentNode = resolveJsonSchemaNode(
    jsonSchema as Record<string, unknown>,
    parentPath,
  ) as JsonSchemaNode | null;
  if (!parentNode) return null;

  // Now get the raw child WITHOUT union unwrapping
  const properties = parentNode.properties as JsonSchemaNode | undefined;
  if (properties && lastSegment in properties) {
    const child = (properties as JsonSchemaNode)[lastSegment] as JsonSchemaNode;
    return resolveRefOnly(child, jsonSchema);
  }

  // Array items (numeric segment)
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

  // additionalProperties fallback
  const additionalProperties = parentNode.additionalProperties as JsonSchemaNode | undefined;
  if (additionalProperties && typeof additionalProperties === "object") {
    return resolveRefOnly(additionalProperties, jsonSchema);
  }

  return null;
}

type JsonSchemaNode = Record<string, unknown>;

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

  // Detect union (anyOf/oneOf) and nullable
  const branches = (node.anyOf ?? node.oneOf) as JsonSchemaNode[] | undefined;
  if (Array.isArray(branches)) {
    const nonNullBranches = branches.filter((b) => b.type !== "null");
    const hasNullBranch = branches.some((b) => b.type === "null");
    info.nullable = hasNullBranch;

    if (nonNullBranches.length === 1) {
      // Simple nullable — treat as the wrapped type
      const inner = nonNullBranches[0] as JsonSchemaNode;
      const innerInfo = extractTypeInfo(inner);
      return { ...innerInfo, nullable: true };
    }

    // True union — enumerate branches
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

  // Standard type
  const rawType = node.type;
  if (typeof rawType === "string") {
    info.type = rawType;
  } else if (Array.isArray(rawType)) {
    const nonNull = (rawType as string[]).filter((t) => t !== "null");
    info.nullable = (rawType as string[]).includes("null");
    info.type = nonNull.length === 1 ? nonNull[0] : nonNull;
  }

  // Scalar constraints
  if (typeof node.format === "string") info.format = node.format;
  if (node.enum !== undefined) info.enum = node.enum as unknown[];
  if (typeof node.pattern === "string") info.pattern = node.pattern;
  if (node.const !== undefined) info.const = node.const;

  // String
  if (typeof node.minLength === "number") info.minLength = node.minLength;
  if (typeof node.maxLength === "number") info.maxLength = node.maxLength;

  // Number
  if (typeof node.minimum === "number") info.minimum = node.minimum;
  if (typeof node.maximum === "number") info.maximum = node.maximum;
  if (typeof node.exclusiveMinimum === "number") info.exclusiveMinimum = node.exclusiveMinimum;
  if (typeof node.exclusiveMaximum === "number") info.exclusiveMaximum = node.exclusiveMaximum;
  if (typeof node.multipleOf === "number") info.multipleOf = node.multipleOf;

  // Array
  if (typeof node.minItems === "number") info.minItems = node.minItems;
  if (typeof node.maxItems === "number") info.maxItems = node.maxItems;
  if (typeof node.uniqueItems === "boolean") info.uniqueItems = node.uniqueItems;

  // Object — list property names
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
  // Bridge: FieldPath → string[] for all legacy internal calls
  const internalPath = toInternalPath(path);

  // schemaNode: unwrapped for navigation (hover/completion child traversal)
  const schemaNode = cache
    ? cache.resolveNode(internalPath)
    : resolveJsonSchemaNode(descriptor.jsonSchema, internalPath);

  // rawNode: $ref resolved but anyOf/oneOf preserved — for accurate typeInfo extraction
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

  // Resolve required status from parent node's required array
  let required = false;
  const lastSegment = path.at(-1);
  if (typeof lastSegment === "string" && path.length > 0) {
    const parentInternalPath = internalPath.slice(0, -1);
    const parentNode = cache
      ? cache.resolveNode(parentInternalPath)
      : resolveJsonSchemaNode(descriptor.jsonSchema, parentInternalPath);
    const requiredArray = parentNode?.required;
    if (Array.isArray(requiredArray)) {
      required = requiredArray.includes(lastSegment);
    }
  }

  return {
    path,
    metadata,
    schemaNode,
    typeInfo: extractTypeInfo(rawNode),
    required,
  };
}
