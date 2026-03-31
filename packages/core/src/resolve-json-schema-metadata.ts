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
 * For anyOf/oneOf (nullable, unions), return the best matching branch.
 * When `nextSegment` is provided, prefers branches that contain it as a property
 * (discriminator-aware selection). Falls back to first non-null branch.
 */
function resolveUnionBranch(
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
      const resolved = resolveRef(branch, root, new Set(seen));
      if (!resolved) continue;
      const props = resolved.properties as JsonSchemaNode | undefined;
      if (props && typeof props === "object" && nextSegment in props) {
        return resolved;
      }
    }
  }

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

  current = resolveUnionBranch(current, root, seen, path[0]);
  if (!current) return null;

  if (path.length === 0) return current;

  const [segment, ...rest] = path;

  const allOf = current.allOf as JsonSchemaNode[] | undefined;
  if (Array.isArray(allOf)) {
    for (const branch of allOf) {
      const resolved = resolveRef(branch, root, new Set(seen));
      if (!resolved) continue;
      const result = traversePath(resolved, root, path, depth + 1);
      if (result) return result;
    }
    return null;
  }

  const properties = current.properties as JsonSchemaNode | undefined;
  if (properties && typeof properties === "object") {
    const child = properties[segment!];
    if (child && typeof child === "object") {
      return traversePath(child as JsonSchemaNode, root, rest, depth + 1);
    }
  }

  const additionalProperties = current.additionalProperties;
  if (
    additionalProperties &&
    typeof additionalProperties === "object" &&
    !(properties && segment! in properties)
  ) {
    return traversePath(
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
      return traversePath(
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

  const xLabels = node["x-enumLabels"];
  if (xLabels && typeof xLabels === "object" && !Array.isArray(xLabels)) {
    meta.enumLabels = xLabels as Record<string, string>;
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
