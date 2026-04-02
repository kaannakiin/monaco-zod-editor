import { describe, test, expect } from "vitest";
import { z } from "../../../core/node_modules/zod/index.js";
import { describeSchema } from "@zod-monaco/core";
import type { SchemaDescriptor } from "@zod-monaco/core";
import {
  buildBreadcrumbSegments,
  buildBreadcrumbLabelCache,
} from "../breadcrumb.js";
import type { PathSegment } from "../json-path-position.js";

function makeDescriptor(
  schema: z.ZodType,
  fields?: Array<{ path: readonly string[]; title?: string; description?: string }>,
  readOnlyPaths?: string[],
): SchemaDescriptor {
  const base = describeSchema(schema, fields?.length ? { metadata: { fields } } : undefined);
  if (readOnlyPaths) {
    return {
      ...base,
      metadata: { ...base.metadata, readOnlyPaths: new Set(readOnlyPaths) },
    };
  }
  return base;
}

describe("buildBreadcrumbSegments", () => {
  test("empty path returns root only", () => {
    const segments = buildBreadcrumbSegments([]);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.label).toBe("root");
    expect(segments[0]!.path).toEqual([]);
  });

  test("simple object path", () => {
    const segments = buildBreadcrumbSegments(["name"]);
    expect(segments).toHaveLength(2);
    expect(segments[0]!.label).toBe("root");
    expect(segments[1]!.label).toBe("name");
    expect(segments[1]!.path).toEqual(["name"]);
  });

  test("array index is collapsed into parent key", () => {
    const path: PathSegment[] = ["items", 0, "title"];
    const segments = buildBreadcrumbSegments(path);
    expect(segments).toHaveLength(3);
    expect(segments[1]!.label).toBe("items[0]");
    expect(segments[1]!.path).toEqual(["items", 0]);
    expect(segments[2]!.label).toBe("title");
  });

  test("root-level array index", () => {
    const path: PathSegment[] = [0, "name"];
    const segments = buildBreadcrumbSegments(path);
    expect(segments[0]!.label).toBe("root[0]");
    expect(segments[0]!.path).toEqual([0]);
    expect(segments[1]!.label).toBe("name");
  });

  test("deeply nested path", () => {
    const path: PathSegment[] = ["a", "b", "c", "d"];
    const segments = buildBreadcrumbSegments(path);
    expect(segments).toHaveLength(5); // root + 4 keys
    expect(segments.map((s) => s.label)).toEqual(["root", "a", "b", "c", "d"]);
  });
});

describe("buildBreadcrumbSegments with metadata enrichment", () => {
  const schema = z.object({
    metadata: z.object({
      owner: z.object({
        name: z.string(),
      }),
    }),
  });

  test("enriches segments with title from metadata", () => {
    const descriptor = makeDescriptor(schema, [
      { path: ["metadata"], title: "Metadata" },
      { path: ["metadata", "owner"], title: "Owner" },
      { path: ["metadata", "owner", "name"], title: "Owner Name" },
    ]);

    const path: PathSegment[] = ["metadata", "owner", "name"];
    const segments = buildBreadcrumbSegments(path, descriptor);

    expect(segments[1]!.title).toBe("Metadata");
    expect(segments[2]!.title).toBe("Owner");
    expect(segments[3]!.title).toBe("Owner Name");
  });

  test("enriches root with descriptor title", () => {
    const descriptor = describeSchema(schema, {
      metadata: { title: "Config" },
    });

    const segments = buildBreadcrumbSegments([], descriptor);
    expect(segments[0]!.title).toBe("Config");
  });

  test("marks read-only segments", () => {
    const descriptor = makeDescriptor(schema, [], ["/metadata/owner"]);

    const path: PathSegment[] = ["metadata", "owner", "name"];
    const segments = buildBreadcrumbSegments(path, descriptor);

    // owner and name should be read-only (ancestor lock propagates)
    expect(segments[2]!.readOnly).toBe(true); // owner
    expect(segments[3]!.readOnly).toBe(true); // name (child of locked owner)
  });

  test("without descriptor, no enrichment", () => {
    const path: PathSegment[] = ["metadata", "owner"];
    const segments = buildBreadcrumbSegments(path);

    expect(segments[1]!.title).toBeUndefined();
    expect(segments[1]!.readOnly).toBeUndefined();
  });
});

describe("buildBreadcrumbLabelCache", () => {
  const schema = z.object({
    id: z.string(),
    label: z.string(),
    metadata: z.object({
      createdAt: z.string(),
    }),
  });

  test("cache returns title for known fields", () => {
    const descriptor = makeDescriptor(schema, [
      { path: ["id"], title: "ID" },
      { path: ["label"], title: "Label" },
      { path: ["metadata", "createdAt"], title: "Created At" },
    ]);

    const cache = buildBreadcrumbLabelCache(descriptor);

    expect(cache.get("/id")?.title).toBe("ID");
    expect(cache.get("/label")?.title).toBe("Label");
    expect(cache.get("/metadata/createdAt")?.title).toBe("Created At");
  });

  test("cache returns undefined for unknown pointers", () => {
    const descriptor = makeDescriptor(schema);
    const cache = buildBreadcrumbLabelCache(descriptor);

    expect(cache.get("/nonexistent")).toBeUndefined();
  });

  test("cache includes readOnly from descriptor", () => {
    const descriptor = makeDescriptor(schema, [], ["/id"]);
    const cache = buildBreadcrumbLabelCache(descriptor);

    expect(cache.get("/id")?.readOnly).toBe(true);
    expect(cache.get("/label")?.readOnly).toBeFalsy();
  });

  test("cache-enriched segments match descriptor-enriched segments", () => {
    const descriptor = makeDescriptor(schema, [
      { path: ["id"], title: "ID" },
      { path: ["label"], title: "Label" },
    ]);
    const cache = buildBreadcrumbLabelCache(descriptor);

    const path: PathSegment[] = ["id"];
    const withCache = buildBreadcrumbSegments(path, descriptor, null, cache);
    const withoutCache = buildBreadcrumbSegments(path, descriptor, null, null);

    expect(withCache[1]!.title).toBe(withoutCache[1]!.title);
  });
});
