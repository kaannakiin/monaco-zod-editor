import type { SchemaDescriptor, FieldPath } from "@zod-monaco/core";
import {
  resolveFieldContext,
  SchemaCache,
  isFieldReadOnly,
  buildFieldCatalog,
  toJsonPointer,
} from "@zod-monaco/core";
import type { PathSegment } from "./json-path-position.js";

export interface BreadcrumbSegment {
  /** Display label: "root", "metadata", "children[0]", "email" */
  label: string;
  /** Full path prefix for navigation via resolveJsonPath */
  path: PropertyKey[];
  /** Human-readable title from field metadata (e.g., "Owner" instead of "owner") */
  title?: string;
  /** Whether this field or its ancestor is read-only */
  readOnly?: boolean;
  /** Field description from metadata */
  description?: string;
}

export interface BreadcrumbLabelCache {
  get(pointer: string): { title?: string; description?: string; readOnly?: boolean } | undefined;
}

/**
 * Builds a pre-computed label cache from the schema catalog.
 * Call once per descriptor, reuse across all cursor movements.
 */
export function buildBreadcrumbLabelCache(
  descriptor: SchemaDescriptor,
): BreadcrumbLabelCache {
  const catalog = buildFieldCatalog(descriptor, { maxDepth: 15 });
  const map = new Map<string, { title?: string; description?: string; readOnly?: boolean }>();

  for (const entry of catalog.fields) {
    if (entry.pointer) {
      map.set(entry.pointer, {
        title: entry.title,
        description: entry.description,
        readOnly: entry.readOnly,
      });
    }
  }

  return { get: (pointer) => map.get(pointer) };
}

/**
 * Converts a typed path from resolvePathAtOffset into displayable
 * breadcrumb segments with array indices collapsed into their parent key.
 *
 * Example: ["children", 0, "name"] →
 *   [{ label: "root", path: [] },
 *    { label: "children[0]", path: ["children", 0] },
 *    { label: "name", path: ["children", 0, "name"] }]
 *
 * When `descriptor` is provided, segments are enriched with metadata
 * (title, readOnly, description) from the schema.
 *
 * When `labelCache` is provided (built via `buildBreadcrumbLabelCache`),
 * enrichment uses O(1) cache lookups instead of per-segment schema traversal.
 */
export function buildBreadcrumbSegments(
  rawPath: PathSegment[],
  descriptor?: SchemaDescriptor | null,
  cache?: SchemaCache | null,
  labelCache?: BreadcrumbLabelCache | null,
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];
  const currentPath: PropertyKey[] = [];

  if (rawPath.length > 0 && typeof rawPath[0] === "number") {
    const idx = rawPath[0];
    currentPath.push(idx);
    const seg: BreadcrumbSegment = { label: `root[${idx}]`, path: [...currentPath] };
    enrichSegment(seg, currentPath as FieldPath, descriptor, cache, labelCache);
    segments.push(seg);

    return buildRemaining(rawPath, 1, currentPath, segments, descriptor, cache, labelCache);
  }

  const rootSeg: BreadcrumbSegment = { label: "root", path: [] };
  if (descriptor) {
    const meta = descriptor.metadata;
    if (meta.title) rootSeg.title = meta.title;
    if (meta.description) rootSeg.description = meta.description;
    if (meta.readOnly) rootSeg.readOnly = true;
  }
  segments.push(rootSeg);
  return buildRemaining(rawPath, 0, currentPath, segments, descriptor, cache, labelCache);
}

function buildRemaining(
  rawPath: PathSegment[],
  startIndex: number,
  currentPath: PropertyKey[],
  segments: BreadcrumbSegment[],
  descriptor?: SchemaDescriptor | null,
  cache?: SchemaCache | null,
  labelCache?: BreadcrumbLabelCache | null,
): BreadcrumbSegment[] {
  let i = startIndex;

  while (i < rawPath.length) {
    const key = rawPath[i]!;
    currentPath.push(key);

    let label = String(key);

    if (i + 1 < rawPath.length && typeof rawPath[i + 1] === "number") {
      i++;
      const idx = rawPath[i]!;
      currentPath.push(idx);
      label = `${key}[${idx}]`;
    }

    const seg: BreadcrumbSegment = { label, path: [...currentPath] };
    enrichSegment(seg, currentPath as FieldPath, descriptor, cache, labelCache);
    segments.push(seg);
    i++;
  }

  return segments;
}

function enrichSegment(
  seg: BreadcrumbSegment,
  path: FieldPath,
  descriptor?: SchemaDescriptor | null,
  cache?: SchemaCache | null,
  labelCache?: BreadcrumbLabelCache | null,
): void {
  if (!descriptor) return;

  if (labelCache) {
    const stringSegments = path.filter((s): s is string => typeof s === "string");
    const pointer = toJsonPointer(stringSegments);
    const cached = labelCache.get(pointer);
    if (cached) {
      if (cached.title) seg.title = cached.title;
      if (cached.description) seg.description = cached.description;
      if (cached.readOnly) seg.readOnly = true;
      return;
    }
  }

  const fieldCtx = resolveFieldContext(descriptor, path, cache ?? undefined);
  if (fieldCtx.metadata?.title) {
    seg.title = fieldCtx.metadata.title;
  }
  if (fieldCtx.metadata?.description) {
    seg.description = fieldCtx.metadata.description;
  }
  if (fieldCtx.readOnly || isFieldReadOnly(descriptor.metadata, path)) {
    seg.readOnly = true;
  }
}
