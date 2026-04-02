import type { PathSegment } from "./json-path-position.js";

export interface BreadcrumbSegment {
  /** Display label: "root", "metadata", "children[0]", "email" */
  label: string;
  /** Full path prefix for navigation via resolveJsonPath */
  path: PropertyKey[];
}

/**
 * Converts a typed path from resolvePathAtOffset into displayable
 * breadcrumb segments with array indices collapsed into their parent key.
 *
 * Example: ["children", 0, "name"] →
 *   [{ label: "root", path: [] },
 *    { label: "children[0]", path: ["children", 0] },
 *    { label: "name", path: ["children", 0, "name"] }]
 */
export function buildBreadcrumbSegments(
  rawPath: PathSegment[],
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];
  const currentPath: PropertyKey[] = [];

  if (rawPath.length > 0 && typeof rawPath[0] === "number") {
    const idx = rawPath[0];
    currentPath.push(idx);
    segments.push({ label: `root[${idx}]`, path: [...currentPath] });

    return buildRemaining(rawPath, 1, currentPath, segments);
  }

  segments.push({ label: "root", path: [] });
  return buildRemaining(rawPath, 0, currentPath, segments);
}

function buildRemaining(
  rawPath: PathSegment[],
  startIndex: number,
  currentPath: PropertyKey[],
  segments: BreadcrumbSegment[],
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

    segments.push({ label, path: [...currentPath] });
    i++;
  }

  return segments;
}
