import { describe, test, expect } from "vitest";
import { z, toJSONSchema } from "zod";
import {
  resolveJsonSchemaNode,
  resolveJsonSchemaMetadata,
} from "../resolve-json-schema-metadata.js";

function schema(s: z.ZodType): Record<string, unknown> {
  return toJSONSchema(s) as Record<string, unknown>;
}

// ── Existing behavior: properties, items, $ref, anyOf/oneOf ──

describe("resolveJsonSchemaNode", () => {
  describe("flat object", () => {
    const js = schema(z.object({ name: z.string(), age: z.number() }));

    test("resolves root", () => {
      const node = resolveJsonSchemaNode(js, []);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("object");
    });

    test("resolves direct property", () => {
      const node = resolveJsonSchemaNode(js, ["name"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });

    test("returns null for unknown property", () => {
      expect(resolveJsonSchemaNode(js, ["missing"])).toBeNull();
    });
  });

  describe("nested object", () => {
    const js = schema(
      z.object({ address: z.object({ street: z.string(), zip: z.number() }) }),
    );

    test("resolves nested property", () => {
      const node = resolveJsonSchemaNode(js, ["address", "street"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });

    test("resolves intermediate object", () => {
      const node = resolveJsonSchemaNode(js, ["address"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("object");
    });
  });

  describe("array of objects", () => {
    const js = schema(z.array(z.object({ id: z.string() })));

    test("resolves array item by numeric index", () => {
      const node = resolveJsonSchemaNode(js, ["0", "id"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });

    test("resolves array item property without numeric index", () => {
      const node = resolveJsonSchemaNode(js, ["id"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });
  });

  describe("nullable", () => {
    const js = schema(z.object({ name: z.string().nullable() }));

    test("resolves nullable field (skips null branch)", () => {
      const node = resolveJsonSchemaNode(js, ["name"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });
  });

  describe("$ref with z.lazy (recursive)", () => {
    const TreeNode: z.ZodType<{ label: string; children: unknown[] }> = z.lazy(
      () =>
        z.object({
          label: z.string(),
          children: z.array(TreeNode),
        }),
    );
    const js = schema(TreeNode);

    test("resolves through $ref", () => {
      const node = resolveJsonSchemaNode(js, ["label"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });

    test("resolves nested recursive path", () => {
      const node = resolveJsonSchemaNode(js, ["children", "0", "label"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });
  });

  // ── Gap tests: currently unsupported, will be fixed in Faz 2 ──

  describe("additionalProperties (z.record)", () => {
    const js = schema(z.record(z.string(), z.number()));

    test("resolves dynamic key via additionalProperties", () => {
      const node = resolveJsonSchemaNode(js, ["anyKey"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("number");
    });
  });

  describe("allOf (z.intersection / .and())", () => {
    const js = schema(
      z.object({ a: z.string() }).and(z.object({ b: z.number() })),
    );

    test("resolves property from first allOf branch", () => {
      const node = resolveJsonSchemaNode(js, ["a"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });

    test("resolves property from second allOf branch", () => {
      const node = resolveJsonSchemaNode(js, ["b"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("number");
    });
  });

  describe("prefixItems (z.tuple)", () => {
    const js = schema(z.tuple([z.string(), z.number()]).rest(z.boolean()));

    test("resolves first tuple element", () => {
      const node = resolveJsonSchemaNode(js, ["0"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });

    test("resolves second tuple element", () => {
      const node = resolveJsonSchemaNode(js, ["1"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("number");
    });

    test("resolves rest element beyond prefix", () => {
      const node = resolveJsonSchemaNode(js, ["5"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("boolean");
    });
  });

  describe("discriminated union (oneOf with disjoint properties)", () => {
    const js = schema(
      z.discriminatedUnion("type", [
        z.object({ type: z.literal("a"), x: z.number() }),
        z.object({ type: z.literal("b"), y: z.string() }),
      ]),
    );

    test("resolves property unique to second branch", () => {
      const node = resolveJsonSchemaNode(js, ["y"]);
      expect(node).not.toBeNull();
      expect(node!.type).toBe("string");
    });

    test("resolves shared discriminator property", () => {
      const node = resolveJsonSchemaNode(js, ["type"]);
      expect(node).not.toBeNull();
    });
  });
});

describe("resolveJsonSchemaMetadata", () => {
  test("extracts title from .describe()", () => {
    const js = schema(
      z.object({ name: z.string().describe("The user name") }),
    );
    const meta = resolveJsonSchemaMetadata(js, ["name"]);
    expect(meta).toBeDefined();
    expect(meta!.description).toBe("The user name");
  });

  test("returns undefined for field without metadata", () => {
    const js = schema(z.object({ count: z.number() }));
    const meta = resolveJsonSchemaMetadata(js, ["count"]);
    expect(meta).toBeUndefined();
  });

  test("extracts root-level metadata", () => {
    const js = schema(z.object({ x: z.number() }).describe("Root object"));
    const meta = resolveJsonSchemaMetadata(js, []);
    expect(meta).toBeDefined();
    expect(meta!.description).toBe("Root object");
  });
});
