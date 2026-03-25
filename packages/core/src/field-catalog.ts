import type { SchemaDescriptor } from "./types.js";
import type { FieldPath, FieldTypeInfo } from "./field-context-types.js";
import { resolveFieldContext } from "./resolve-field-context.js";
import { resolveJsonSchemaNode } from "./resolve-json-schema-metadata.js";
import { toJsonPointer } from "./path-utils.js";

type JsonSchemaNode = Record<string, unknown>;

// ─── Public types ────────────────────────────────────────────────────────────

/** A single branch of a union field (oneOf / anyOf). */
export interface CatalogBranch {
  /** Discriminator key, e.g. "kind" — present when detectable. */
  discriminatorKey?: string;
  /** Value of the discriminator for this branch, e.g. "text". */
  discriminatorValue?: unknown;
  /** Fields belonging ONLY to this branch. */
  fields: FieldCatalogEntry[];
}

/** A single field entry in the catalog — safe to serialize (no schemaNode). */
export interface FieldCatalogEntry {
  /** Typed path segments. */
  path: FieldPath;
  /**
   * RFC 6901 JSON Pointer.
   * `null` for wildcard / template entries (array items, additionalProperties).
   */
  pointer: string | null;
  /**
   * Pattern with `*` wildcard — present only for array-item or
   * additionalProperties entries where a concrete pointer is unavailable.
   */
  pathPattern?: string;
  title?: string;
  description?: string;
  examples?: unknown[];
  enumLabels?: Record<string, string>;
  typeInfo: FieldTypeInfo;
  required: boolean;
  /** True when this entry was cut by the recursion unroll limit. */
  recursive?: boolean;
  /** Current value at this path, when `currentValue` was supplied. */
  currentValue?: unknown;
  /** Present when this field is a union (oneOf / anyOf). */
  branches?: CatalogBranch[];
}

/** The full field catalog produced by `buildFieldCatalog`. */
export interface FieldCatalog {
  /** Entry for the root schema node itself. */
  root: FieldCatalogEntry;
  /**
   * Flat ordered list of all field entries.
   * Branch-specific fields are NOT included here — they live inside
   * `entry.branches[n].fields`.
   */
  fields: FieldCatalogEntry[];
}

/** Options for `buildFieldCatalog`. */
export interface CatalogOptions {
  /** Maximum traversal depth (default: 15). */
  maxDepth?: number;
  /** Current JSON value — overlaid onto entries as `currentValue`. */
  currentValue?: unknown;
  /**
   * When provided, only enumerate fields under this path.
   * The root entry still represents the focusPath node.
   */
  focusPath?: FieldPath;
  /**
   * How many times a recursive `$ref` is unrolled before cutting.
   * Default: 1 — the recursive type's children are shown once, then cut.
   */
  recursionUnrollDepth?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  const defs = root[match[1] as string];
  if (!defs || typeof defs !== "object") return null;
  const resolved = (defs as JsonSchemaNode)[match[2] as string];
  if (!resolved || typeof resolved !== "object") return null;
  return resolveRef(resolved as JsonSchemaNode, root, seen);
}

/** Fully resolves a node: $ref + allOf merge. Does NOT unwrap anyOf/oneOf. */
function resolveNode(
  node: JsonSchemaNode,
  root: JsonSchemaNode,
  seen: Set<string>,
): JsonSchemaNode | null {
  const resolved = resolveRef(node, root, seen);
  if (!resolved) return null;

  // Merge allOf branches into a single node
  const allOf = resolved.allOf as JsonSchemaNode[] | undefined;
  if (Array.isArray(allOf)) {
    const merged: JsonSchemaNode = { ...resolved };
    delete merged.allOf;
    for (const branch of allOf) {
      const b = resolveRef(branch, root, new Set(seen));
      if (!b) continue;
      if (b.properties && typeof b.properties === "object") {
        merged.properties = { ...(merged.properties as object ?? {}), ...(b.properties as object) };
      }
      if (Array.isArray(b.required)) {
        merged.required = [...(Array.isArray(merged.required) ? merged.required as unknown[] : []), ...(b.required as unknown[])];
      }
    }
    return merged;
  }

  return resolved;
}

/** Get value at path from an unknown JS value. */
function getValueAtPath(value: unknown, path: FieldPath): unknown {
  let current = value;
  for (const segment of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[String(segment)];
  }
  return current;
}

/** Detect discriminator key for a set of oneOf/anyOf branches. */
function detectDiscriminator(
  branches: JsonSchemaNode[],
): string | undefined {
  const nonNull = branches.filter((b) => b.type !== "null");
  if (nonNull.length < 2) return undefined;

  const propSets = nonNull.map((b) => {
    const props = b.properties as JsonSchemaNode | undefined;
    return props ? Object.keys(props) : [];
  });

  // Find a property that all branches have with a `const` value
  const candidates = propSets[0]?.filter((key) =>
    nonNull.every((b) => {
      const props = b.properties as JsonSchemaNode | undefined;
      return props && key in props && (props[key] as JsonSchemaNode)?.const !== undefined;
    })
  );
  return candidates?.[0];
}

// ─── Walker ──────────────────────────────────────────────────────────────────

interface WalkContext {
  descriptor: SchemaDescriptor;
  root: JsonSchemaNode;
  maxDepth: number;
  recursionUnrollDepth: number;
  currentValue: unknown;
  /** Maps $ref string → number of times it has been entered (unroll counter). */
  refCounts: Map<string, number>;
  /** Output — flat list (branch fields are NOT pushed here). */
  fields: FieldCatalogEntry[];
}

/**
 * Walks a schema node and emits catalog entries.
 * `path` is the current FieldPath.
 * `node` is the raw schema node (before $ref / allOf resolution).
 * `required` is whether this field is required by its parent.
 */
function walkNode(
  ctx: WalkContext,
  node: JsonSchemaNode,
  path: FieldPath,
  required: boolean,
  depth: number,
): FieldCatalogEntry | null {
  if (depth > ctx.maxDepth) return null;

  const seen = new Set<string>();

  // Detect recursion: track $ref visits
  const ref = node.$ref as string | undefined;
  let refKey: string | null = null;

  if (typeof ref === "string") {
    refKey = ref;
    const count = ctx.refCounts.get(refKey) ?? 0;
    if (count >= ctx.recursionUnrollDepth) {
      // Cut: emit recursive marker entry
      const ctx2 = resolveFieldContext(ctx.descriptor, path);
      const entry: FieldCatalogEntry = {
        path,
        pointer: toJsonPointer(path),
        typeInfo: ctx2.typeInfo,
        required,
        recursive: true,
      };
      if (ctx2.metadata) {
        if (ctx2.metadata.title) entry.title = ctx2.metadata.title;
        if (ctx2.metadata.description) entry.description = ctx2.metadata.description;
        if (ctx2.metadata.examples) entry.examples = ctx2.metadata.examples;
        if (ctx2.metadata.enumLabels) entry.enumLabels = ctx2.metadata.enumLabels;
      }
      return entry;
    }
    ctx.refCounts.set(refKey, (ctx.refCounts.get(refKey) ?? 0) + 1);
  }

  // Resolve $ref + allOf
  const resolved = resolveNode(node, ctx.root, seen);

  let entry: FieldCatalogEntry | null = null;

  if (!resolved) {
    if (refKey) ctx.refCounts.set(refKey, (ctx.refCounts.get(refKey) ?? 1) - 1);
    return null;
  }

  entry = buildEntry(ctx, resolved, node, path, required, depth, seen);

  if (refKey) {
    ctx.refCounts.set(refKey, (ctx.refCounts.get(refKey) ?? 1) - 1);
  }

  return entry;
}

function buildEntry(
  ctx: WalkContext,
  resolved: JsonSchemaNode,
  rawNode: JsonSchemaNode,
  path: FieldPath,
  required: boolean,
  depth: number,
  seen: Set<string>,
): FieldCatalogEntry {
  const fieldCtx = resolveFieldContext(ctx.descriptor, path);
  const meta = fieldCtx.metadata;

  const entry: FieldCatalogEntry = {
    path,
    pointer: toJsonPointer(path),
    typeInfo: fieldCtx.typeInfo,
    required,
  };

  if (meta) {
    if (meta.title) entry.title = meta.title;
    if (meta.description) entry.description = meta.description;
    if (meta.examples) entry.examples = meta.examples;
    if (meta.enumLabels) entry.enumLabels = meta.enumLabels;
  }

  const cv = getValueAtPath(ctx.currentValue, path);
  if (cv !== undefined) entry.currentValue = cv;

  // ── anyOf / oneOf: union handling ──────────────────────────────────────────
  const unionBranches = (resolved.anyOf ?? resolved.oneOf) as JsonSchemaNode[] | undefined;
  if (Array.isArray(unionBranches)) {
    const nonNullBranches = unionBranches.filter((b) => b.type !== "null");

    if (nonNullBranches.length > 1) {
      // True union — build CatalogBranch entries
      const discriminatorKey = detectDiscriminator(nonNullBranches);
      entry.branches = nonNullBranches.map((branchNode) => {
        const bResolved = resolveNode(branchNode, ctx.root, new Set(seen));
        if (!bResolved) return { fields: [] };

        const branch: CatalogBranch = { fields: [] };
        if (discriminatorKey) {
          branch.discriminatorKey = discriminatorKey;
          const props = bResolved.properties as JsonSchemaNode | undefined;
          if (props && discriminatorKey in props) {
            const discProp = props[discriminatorKey] as JsonSchemaNode;
            if (discProp.const !== undefined) {
              branch.discriminatorValue = discProp.const;
            }
          }
        }

        // Walk branch-specific properties
        const branchFields: FieldCatalogEntry[] = [];
        const props = bResolved.properties as JsonSchemaNode | undefined;
        if (props) {
          const reqArray = Array.isArray(bResolved.required) ? bResolved.required as string[] : [];
          for (const [key, childNode] of Object.entries(props)) {
            const childPath: FieldPath = [...path, key];
            const childRequired = reqArray.includes(key);
            const childEntry = walkNode(ctx, childNode as JsonSchemaNode, childPath, childRequired, depth + 1);
            if (childEntry) branchFields.push(childEntry);
          }
        }
        branch.fields = branchFields;
        return branch;
      });

      // Branch-specific fields live in entry.branches — not in flat list
      return entry;
    }

    // Single non-null branch = nullable wrapper — unwrap and walk as if it's that type
    const innerNode = nonNullBranches[0];
    if (innerNode) {
      const innerResolved = resolveNode(innerNode as JsonSchemaNode, ctx.root, new Set(seen));
      if (innerResolved) {
        return buildEntry(ctx, innerResolved, innerNode as JsonSchemaNode, path, required, depth, seen);
      }
    }
    return entry;
  }

  // ── object: walk properties ─────────────────────────────────────────────────
  const properties = resolved.properties as JsonSchemaNode | undefined;
  if (properties && typeof properties === "object") {
    const reqArray = Array.isArray(resolved.required) ? resolved.required as string[] : [];
    for (const [key, childNode] of Object.entries(properties)) {
      const childPath: FieldPath = [...path, key];
      const childRequired = reqArray.includes(key);
      const childEntry = walkNode(ctx, childNode as JsonSchemaNode, childPath, childRequired, depth + 1);
      if (childEntry) ctx.fields.push(childEntry);
    }
  }

  // additionalProperties (record schemas)
  const addlProps = resolved.additionalProperties;
  if (addlProps && typeof addlProps === "object" && !Array.isArray(addlProps)) {
    const wildcardPattern = toJsonPointer(path) + "/*";
    const wildcardEntry: FieldCatalogEntry = {
      path: [...path, "*"] as unknown as FieldPath,
      pointer: null,
      pathPattern: wildcardPattern === "/*" ? "/*" : wildcardPattern,
      typeInfo: resolveFieldContext(ctx.descriptor, path).typeInfo, // approximate
      required: false,
    };
    // Build proper typeInfo from the additionalProperties node
    const addlCtx = resolveFieldContext(ctx.descriptor, [...path, "__additionalProperties__"]);
    // Use a direct approach — addlProps as-is
    const addlNode = addlProps as JsonSchemaNode;
    if (typeof addlNode.type === "string") {
      wildcardEntry.typeInfo = { type: addlNode.type, nullable: false };
    }
    ctx.fields.push(wildcardEntry);
  }

  // ── array: items / prefixItems ──────────────────────────────────────────────
  const prefixItems = resolved.prefixItems as JsonSchemaNode[] | undefined;
  if (Array.isArray(prefixItems)) {
    prefixItems.forEach((itemNode, idx) => {
      const itemPath: FieldPath = [...path, idx];
      const itemEntry = walkNode(ctx, itemNode as JsonSchemaNode, itemPath, true, depth + 1);
      if (itemEntry) ctx.fields.push(itemEntry);
    });
  }

  const items = resolved.items as JsonSchemaNode | undefined;
  if (items && typeof items === "object" && !Array.isArray(items)) {
    const wildcardPattern = toJsonPointer(path) + "/*";
    const itemEntry = walkItemWildcard(ctx, items, path, wildcardPattern, depth + 1);
    if (itemEntry) ctx.fields.push(itemEntry);
  }

  return entry;
}

/** Emits a wildcard entry for array items (pointer: null, pathPattern: "/foo/*"). */
function walkItemWildcard(
  ctx: WalkContext,
  itemNode: JsonSchemaNode,
  arrayPath: FieldPath,
  wildcardPattern: string,
  depth: number,
): FieldCatalogEntry | null {
  if (depth > ctx.maxDepth) return null;

  const seen = new Set<string>();
  const ref = itemNode.$ref as string | undefined;
  let refKey: string | null = null;

  if (typeof ref === "string") {
    refKey = ref;
    const count = ctx.refCounts.get(refKey) ?? 0;
    if (count >= ctx.recursionUnrollDepth) {
      return {
        path: arrayPath,
        pointer: null,
        pathPattern: wildcardPattern,
        typeInfo: { type: undefined, nullable: false },
        required: false,
        recursive: true,
      };
    }
    ctx.refCounts.set(refKey, (ctx.refCounts.get(refKey) ?? 0) + 1);
  }

  const resolved = resolveNode(itemNode, ctx.root, seen);
  if (!resolved) {
    if (refKey) ctx.refCounts.set(refKey, (ctx.refCounts.get(refKey) ?? 1) - 1);
    return null;
  }

  // Build a synthetic path for metadata/typeInfo lookup
  // We use the array path itself since items don't have a fixed key
  const fieldCtx = resolveFieldContext(ctx.descriptor, arrayPath);
  const itemTypeInfo = fieldCtx.typeInfo;

  const entry: FieldCatalogEntry = {
    path: arrayPath,
    pointer: null,
    pathPattern: wildcardPattern,
    typeInfo: itemTypeInfo,
    required: false,
  };

  // Walk item properties into flat list
  const properties = resolved.properties as JsonSchemaNode | undefined;
  if (properties) {
    const reqArray = Array.isArray(resolved.required) ? resolved.required as string[] : [];
    for (const [key, childNode] of Object.entries(properties)) {
      // Use a representative concrete path (wildcard path not tracked here)
      const childPath: FieldPath = [...arrayPath, 0, key];
      const childRequired = reqArray.includes(key);
      const childEntry = walkNode(ctx, childNode as JsonSchemaNode, childPath, childRequired, depth + 1);
      if (childEntry) ctx.fields.push(childEntry);
    }
  }

  if (refKey) ctx.refCounts.set(refKey, (ctx.refCounts.get(refKey) ?? 1) - 1);
  return entry;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Builds a complete field catalog by walking the JSON Schema.
 *
 * - Works without a `currentValue` (schema-first) — value is an optional overlay.
 * - Union branches are grouped in `entry.branches`, never flattened into the top-level list.
 * - Recursive `$ref` schemas are unrolled `recursionUnrollDepth` times (default: 1).
 * - Array items produce wildcard entries (`pointer: null`, `pathPattern: "/foo/*"`).
 * - `focusPath` restricts enumeration to a subtree.
 */
export function buildFieldCatalog(
  descriptor: SchemaDescriptor,
  options: CatalogOptions = {},
): FieldCatalog {
  const {
    maxDepth = 15,
    currentValue,
    focusPath,
    recursionUnrollDepth = 1,
  } = options;

  const jsonSchema = descriptor.jsonSchema as JsonSchemaNode;

  // Determine start node and path
  let startNode: JsonSchemaNode = jsonSchema;
  let startPath: FieldPath = [];

  if (focusPath && focusPath.length > 0) {
    startPath = focusPath;
    const internalPath = focusPath.map(String);
    const focusNode = resolveJsonSchemaNode(jsonSchema as Record<string, unknown>, internalPath) as JsonSchemaNode | null;
    if (focusNode) {
      startNode = focusNode;
    }
  }

  const ctx: WalkContext = {
    descriptor,
    root: jsonSchema,
    maxDepth,
    recursionUnrollDepth,
    currentValue,
    refCounts: new Map(),
    fields: [],
  };

  const rootEntry = walkNode(ctx, startNode, startPath, false, 0);

  const root: FieldCatalogEntry = rootEntry ?? {
    path: startPath,
    pointer: toJsonPointer(startPath),
    typeInfo: { type: undefined, nullable: false },
    required: false,
  };

  return { root, fields: ctx.fields };
}
