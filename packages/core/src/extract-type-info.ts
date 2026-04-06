import type { FieldTypeInfo, UnionBranchSummary } from "./field-context-types.js";

type JsonSchemaNode = Record<string, unknown>;

/**
 * Resolves a $ref pointer without unwrapping anyOf/oneOf.
 * Used to get the raw node (preserving union wrappers) for type extraction.
 */
export function resolveRefOnly(
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
 * Merges allOf branches into a single node with combined properties and required arrays.
 * Mirrors the pattern in field-catalog.ts resolveNode().
 */
export function mergeAllOfBranches(
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
 * Gets the raw schema node at path WITHOUT unwrapping anyOf/oneOf on the terminal node.
 * Used so extractTypeInfo can see union wrappers (nullable, discriminated unions).
 */
export function resolveRawSchemaNode(
  jsonSchema: JsonSchemaNode,
  path: string[],
): JsonSchemaNode | null {
  if (path.length === 0) {
    return resolveRefOnly(jsonSchema, jsonSchema);
  }

  // We need resolveJsonSchemaNode for the parent — import lazily to avoid circular deps
  const parentPath = path.slice(0, -1);
  const lastSegment = path[path.length - 1]!;

  // Inline parent resolution: traverse to parent using the same logic
  const parentNodeRaw = resolveJsonSchemaNodeInline(jsonSchema, parentPath);
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

/**
 * Minimal inline JSON Schema node resolver — avoids importing from
 * resolve-json-schema-metadata.ts to keep this module dependency-free.
 * Only used internally by resolveRawSchemaNode for parent resolution.
 */
function resolveJsonSchemaNodeInline(
  jsonSchema: JsonSchemaNode,
  path: string[],
): JsonSchemaNode | null {
  return traversePathInline(jsonSchema, jsonSchema, path, 0);
}

function resolveUnionBranchInline(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
  seen: Set<string>,
  nextSegment?: string,
): JsonSchemaNode | null {
  const branches = (node.anyOf ?? node.oneOf) as JsonSchemaNode[] | undefined;
  if (!Array.isArray(branches)) return node;

  if (nextSegment) {
    for (const branch of branches) {
      if (branch.type === "null") continue;
      const resolved = resolveRefOnly(branch, root, new Set(seen));
      if (!resolved) continue;
      const props = resolved.properties as JsonSchemaNode | undefined;
      if (props && typeof props === "object" && nextSegment in props) {
        return resolved;
      }
    }
  }

  for (const branch of branches) {
    if (branch.type === "null") continue;
    const resolved = resolveRefOnly(branch, root, new Set(seen));
    if (resolved) return resolved;
  }

  return null;
}

function traversePathInline(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
  path: string[],
  depth: number,
): JsonSchemaNode | null {
  if (depth > 20) return null;

  const seen = new Set<string>();
  let current = resolveRefOnly(node, root, seen);
  if (!current) return null;

  current = resolveUnionBranchInline(current, root, seen, path[0]);
  if (!current) return null;

  if (path.length === 0) return current;

  const [segment, ...rest] = path;

  const allOf = current.allOf as JsonSchemaNode[] | undefined;
  if (Array.isArray(allOf)) {
    for (const branch of allOf) {
      const resolved = resolveRefOnly(branch, root, new Set(seen));
      if (!resolved) continue;
      const result = traversePathInline(resolved, root, path, depth + 1);
      if (result) return result;
    }
    return null;
  }

  const properties = current.properties as JsonSchemaNode | undefined;
  if (properties && typeof properties === "object") {
    const child = properties[segment!];
    if (child && typeof child === "object") {
      return traversePathInline(child as JsonSchemaNode, root, rest, depth + 1);
    }
  }

  const additionalProperties = current.additionalProperties;
  if (
    additionalProperties &&
    typeof additionalProperties === "object" &&
    !(properties && segment! in properties)
  ) {
    return traversePathInline(
      additionalProperties as JsonSchemaNode,
      root,
      rest,
      depth + 1,
    );
  }

  const prefixItems = current.prefixItems as JsonSchemaNode[] | undefined;
  if (Array.isArray(prefixItems) && /^\d+$/.test(segment!)) {
    const idx = parseInt(segment!, 10);
    if (idx < prefixItems.length) {
      return traversePathInline(
        prefixItems[idx] as JsonSchemaNode,
        root,
        rest,
        depth + 1,
      );
    }
  }

  const items = current.items as JsonSchemaNode | undefined;
  if (items && typeof items === "object") {
    if (/^\d+$/.test(segment!)) {
      return traversePathInline(items, root, rest, depth + 1);
    }
    return traversePathInline(items, root, path, depth + 1);
  }

  return null;
}

/**
 * Extracts typed constraint information from a raw JSON Schema node.
 * Handles nullable detection from anyOf/oneOf null branches.
 */
export function extractTypeInfo(node: JsonSchemaNode | null): FieldTypeInfo {
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
