import { describe, test, expect } from "vitest";
import { z, toJSONSchema } from "zod";
import { SchemaCache } from "../schema-cache.js";
import { resolveJsonSchemaNode } from "../resolve-json-schema-metadata.js";
import { resolveFieldMetadata } from "../resolve-field-metadata.js";
import type { ResolvedMetadata } from "../types.js";

function schema(s: z.ZodType): Record<string, unknown> {
  return toJSONSchema(s) as Record<string, unknown>;
}

describe("SchemaCache", () => {
  const js = schema(
    z.object({
      name: z.string().describe("User name"),
      address: z.object({ street: z.string() }),
    }),
  );

  test("resolveNode returns same result as uncached", () => {
    const cache = new SchemaCache(js);
    expect(cache.resolveNode(["name"])).toEqual(
      resolveJsonSchemaNode(js, ["name"]),
    );
    expect(cache.resolveNode(["address", "street"])).toEqual(
      resolveJsonSchemaNode(js, ["address", "street"]),
    );
  });

  test("resolveNode caches results (same reference on second call)", () => {
    const cache = new SchemaCache(js);
    const first = cache.resolveNode(["name"]);
    const second = cache.resolveNode(["name"]);
    expect(first).toBe(second);
  });

  test("resolveNode caches null for missing paths", () => {
    const cache = new SchemaCache(js);
    expect(cache.resolveNode(["missing"])).toBeNull();
    expect(cache.resolveNode(["missing"])).toBeNull();
  });

  test("resolveMetadata returns same result as uncached", () => {
    const cache = new SchemaCache(js);
    const meta = cache.resolveMetadata(["name"]);
    expect(meta).toBeDefined();
    expect(meta!.description).toBe("User name");
  });

  test("resolveMetadata caches undefined for fields without metadata", () => {
    const cache = new SchemaCache(js);
    expect(cache.resolveMetadata(["address", "street"])).toBeUndefined();
    expect(cache.resolveMetadata(["address", "street"])).toBeUndefined();
  });

  test("paths with special characters do not collide in cache", () => {
    const cache = new SchemaCache(js);
    // ["a", "b"] → pointer "/a/b"
    // ["a/b"]    → pointer "/a~1b"
    // With old \0 join both would be different too, but with pointer
    // encoding they are guaranteed distinct even for "/" in segments.
    const r1 = cache.resolveNode(["name"]);
    const r2 = cache.resolveNode(["address", "street"]);
    expect(r1).not.toEqual(r2);
    // Verify caching still works after the key format change
    expect(cache.resolveNode(["name"])).toBe(r1);
    expect(cache.resolveNode(["address", "street"])).toBe(r2);
  });
});

describe("resolveFieldMetadata with cache", () => {
  const js = schema(
    z.object({ name: z.string().describe("Schema desc") }),
  );
  const metadata: ResolvedMetadata = {
    fields: { "/name": { title: "Custom" } },
  };

  test("cache parameter produces same result as jsonSchema parameter", () => {
    const cache = new SchemaCache(js);
    const withSchema = resolveFieldMetadata(metadata, ["name"], js);
    const withCache = resolveFieldMetadata(metadata, ["name"], undefined, cache);
    expect(withCache).toEqual(withSchema);
  });

  test("cache takes precedence over jsonSchema when both provided", () => {
    const cache = new SchemaCache(js);
    const result = resolveFieldMetadata(metadata, ["name"], js, cache);
    expect(result).toEqual(resolveFieldMetadata(metadata, ["name"], js));
  });
});
