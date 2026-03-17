import type { FieldMetadata } from "./types.js";

type JsonSchemaNode = Record<string, unknown>;

/**
 * Resolves a JSON Schema node by following `$ref` pointers.
 * Uses a Set to detect cycles (e.g. `$ref: "#"` from z.lazy).
 */
function resolveRef(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
  seen: Set<string>,
): JsonSchemaNode | null {
  const ref = node.$ref;
  if (typeof ref !== "string") return node;

  if (seen.has(ref)) return null;
  seen.add(ref);

  if (ref === "#") return root;

  const match = ref.match(/^#\/(\$defs|definitions)\/(.+)$/);
  if (!match) return null;

  const defsKey = match[1] as string;
  const defName = match[2] as string;
  const defs = root[defsKey];
  if (!defs || typeof defs !== "object") return null;

  const resolved = (defs as JsonSchemaNode)[defName];
  if (!resolved || typeof resolved !== "object") return null;

  return resolveRef(resolved as JsonSchemaNode, root, seen);
}

/**
 * For anyOf/oneOf (nullable, unions), return the first non-null branch.
 */
function resolveUnionBranch(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
  seen: Set<string>,
): JsonSchemaNode | null {
  const branches = (node.anyOf ?? node.oneOf) as JsonSchemaNode[] | undefined;
  if (!Array.isArray(branches)) return node;

  for (const branch of branches) {
    if (branch.type === "null") continue;
    const resolved = resolveRef(branch, root, new Set(seen));
    if (resolved) return resolved;
  }

  return null;
}

/**
 * Traverse a JSON Schema following a path of property names.
 * Handles $ref, anyOf/oneOf, items (arrays), and properties (objects).
 */
function traversePath(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
  path: string[],
  depth: number,
): JsonSchemaNode | null {
  if (depth > 20) return null;

  const seen = new Set<string>();
  let current = resolveRef(node, root, seen);
  if (!current) return null;

  current = resolveUnionBranch(current, root, seen);
  if (!current) return null;

  if (path.length === 0) return current;

  const [segment, ...rest] = path;

  const properties = current.properties as JsonSchemaNode | undefined;
  if (properties && typeof properties === "object") {
    const child = properties[segment!];
    if (child && typeof child === "object") {
      return traversePath(child as JsonSchemaNode, root, rest, depth + 1);
    }
  }

  const items = current.items as JsonSchemaNode | undefined;
  if (items && typeof items === "object") {
    if (/^\d+$/.test(segment!)) {
      return traversePath(items, root, rest, depth + 1);
    }

    return traversePath(items, root, path, depth + 1);
  }

  return null;
}

/**
 * Extract FieldMetadata from a JSON Schema node's title/description/examples.
 */
function extractMetadata(node: JsonSchemaNode): FieldMetadata | undefined {
  const meta: FieldMetadata = {};
  let hasAny = false;

  if (typeof node.title === "string") {
    meta.title = node.title;
    hasAny = true;
  }

  if (typeof node.description === "string") {
    meta.description = node.description;
    hasAny = true;
  }

  if (Array.isArray(node.examples)) {
    meta.examples = node.examples;
    hasAny = true;
  }

  return hasAny ? meta : undefined;
}

/**
 * Resolves the JSON Schema node at the given field path.
 * Follows $ref, anyOf/oneOf, properties, and items.
 * Returns the resolved node or null if the path cannot be traversed.
 */
export function resolveJsonSchemaNode(
  jsonSchema: Record<string, unknown>,
  path: string[],
): Record<string, unknown> | null {
  return traversePath(jsonSchema, jsonSchema, path, 0);
}

/**
 * Resolves metadata for a field by traversing the JSON Schema.
 * Follows $ref, anyOf/oneOf, properties, and items.
 */
export function resolveJsonSchemaMetadata(
  jsonSchema: Record<string, unknown>,
  path: string[],
): FieldMetadata | undefined {
  const node = traversePath(jsonSchema, jsonSchema, path, 0);
  if (!node) return undefined;

  return extractMetadata(node);
}
