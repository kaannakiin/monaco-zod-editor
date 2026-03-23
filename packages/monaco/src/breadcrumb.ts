export interface BreadcrumbSegment {
  /** Display label: "root", "metadata", "children[0]", "email" */
  label: string;
  /** Full path prefix for navigation via resolveJsonPath */
  path: PropertyKey[];
}

/**
 * Converts a raw string path from resolvePathAtOffset into displayable
 * breadcrumb segments with array indices collapsed into their parent key.
 *
 * Example: ["children", "0", "name"] →
 *   [{ label: "root", path: [] },
 *    { label: "children[0]", path: ["children", 0] },
 *    { label: "name", path: ["children", 0, "name"] }]
 */
export function buildBreadcrumbSegments(
  rawPath: string[],
): BreadcrumbSegment[] {
  const segments: BreadcrumbSegment[] = [];
  const currentPath: PropertyKey[] = [];

  if (rawPath.length > 0 && isNumericIndex(rawPath[0]!)) {
    const idx = Number(rawPath[0]);
    currentPath.push(idx);
    segments.push({ label: `root[${idx}]`, path: [...currentPath] });

    return buildRemaining(rawPath, 1, currentPath, segments);
  }

  segments.push({ label: "root", path: [] });
  return buildRemaining(rawPath, 0, currentPath, segments);
}

function buildRemaining(
  rawPath: string[],
  startIndex: number,
  currentPath: PropertyKey[],
  segments: BreadcrumbSegment[],
): BreadcrumbSegment[] {
  let i = startIndex;

  while (i < rawPath.length) {
    const key = rawPath[i]!;
    currentPath.push(key);

    let label = key;

    if (i + 1 < rawPath.length && isNumericIndex(rawPath[i + 1]!)) {
      i++;
      const idx = Number(rawPath[i]!);
      currentPath.push(idx);
      label = `${key}[${idx}]`;
    }

    segments.push({ label, path: [...currentPath] });
    i++;
  }

  return segments;
}

function isNumericIndex(value: string): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && String(Math.floor(n)) === value;
}
