import { describe, test, expect } from "vitest";
import { z, toJSONSchema } from "zod";
import { applyEnumRefinements, validateEnumRefinements } from "../apply-refinements.js";
import { describeSchema } from "../describe-schema.js";

function schema(s: z.ZodType): Record<string, unknown> {
  return toJSONSchema(s) as Record<string, unknown>;
}

function nodeAt(
  js: Record<string, unknown>,
  path: string[],
): Record<string, unknown> {
  let node = js as Record<string, unknown>;
  for (const seg of path) {
    const props = node.properties as Record<string, unknown> | undefined;
    if (props && seg in props) {
      node = props[seg] as Record<string, unknown>;
    } else {
      throw new Error(`Path segment "${seg}" not found in properties`);
    }
  }
  return node;
}

describe("applyEnumRefinements", () => {
  test("injects enum into correct node", () => {
    const js = schema(z.object({ status: z.string() }));
    applyEnumRefinements(js, [
      { path: ["status"], enum: ["active", "inactive"] },
    ]);
    const node = nodeAt(js, ["status"]);
    expect(node.enum).toEqual(["active", "inactive"]);
  });

  test("stores labels as x-enumLabels vendor extension", () => {
    const js = schema(z.object({ status: z.string() }));
    applyEnumRefinements(js, [
      {
        path: ["status"],
        enum: ["a", "b"],
        labels: { a: "Label A", b: "Label B" },
      },
    ]);
    const node = nodeAt(js, ["status"]);
    expect(node["x-enumLabels"]).toEqual({ a: "Label A", b: "Label B" });
  });

  test("empty enum is no-op", () => {
    const js = schema(z.object({ status: z.string() }));
    applyEnumRefinements(js, [{ path: ["status"], enum: [] }]);
    const node = nodeAt(js, ["status"]);
    expect(node.enum).toBeUndefined();
  });

  test("throws for missing path", () => {
    const js = schema(z.object({ status: z.string() }));
    expect(() =>
      applyEnumRefinements(js, [
        { path: ["nonexistent"], enum: ["a"] },
      ]),
    ).toThrow("Refinement target not found: /nonexistent");
  });

  test("throws for object target", () => {
    const js = schema(
      z.object({ nested: z.object({ x: z.string() }) }),
    );
    expect(() =>
      applyEnumRefinements(js, [
        { path: ["nested"], enum: ["a"] },
      ]),
    ).toThrow(/has type "object"/);
  });

  test("throws for array target", () => {
    const js = schema(z.object({ items: z.array(z.string()) }));
    expect(() =>
      applyEnumRefinements(js, [{ path: ["items"], enum: ["a"] }]),
    ).toThrow(/has type "array"/);
  });

  test("works with nested paths", () => {
    const js = schema(
      z.object({ a: z.object({ b: z.string() }) }),
    );
    applyEnumRefinements(js, [
      { path: ["a", "b"], enum: ["x", "y"] },
    ]);
    const node = nodeAt(js, ["a"]);
    const inner = (node.properties as Record<string, unknown>)[
      "b"
    ] as Record<string, unknown>;
    expect(inner.enum).toEqual(["x", "y"]);
  });

  test("works with nullable field", () => {
    const js = schema(
      z.object({ status: z.string().nullable() }),
    );
    applyEnumRefinements(js, [
      { path: ["status"], enum: ["a", "b"] },
    ]);
    // nullable produces anyOf with null + string branch
    // resolveJsonSchemaNode picks the non-null branch
    const statusNode = (
      js.properties as Record<string, unknown>
    )["status"] as Record<string, unknown>;
    const branches = (statusNode.anyOf ?? statusNode.oneOf) as
      | Record<string, unknown>[]
      | undefined;
    if (branches) {
      const stringBranch = branches.find((b) => b.type !== "null");
      expect(stringBranch?.enum).toEqual(["a", "b"]);
    } else {
      // fallback: direct node
      expect(statusNode.enum).toEqual(["a", "b"]);
    }
  });

  test("applies multiple refinements to same schema", () => {
    const js = schema(
      z.object({ a: z.string(), b: z.number() }),
    );
    applyEnumRefinements(js, [
      { path: ["a"], enum: ["x", "y"] },
      { path: ["b"], enum: ["1", "2"] },
    ]);
    expect(nodeAt(js, ["a"]).enum).toEqual(["x", "y"]);
    expect(nodeAt(js, ["b"]).enum).toEqual(["1", "2"]);
  });

  test("does not add x-enumLabels when labels not provided", () => {
    const js = schema(z.object({ status: z.string() }));
    applyEnumRefinements(js, [
      { path: ["status"], enum: ["a", "b"] },
    ]);
    const node = nodeAt(js, ["status"]);
    expect(node["x-enumLabels"]).toBeUndefined();
  });
});

describe("describeSchema with refinements", () => {
  test("refinements are injected into JSON Schema", () => {
    const descriptor = describeSchema(
      z.object({ status: z.string() }),
      {
        refinements: [
          { path: ["status"], enum: ["active", "inactive"] },
        ],
      },
    );
    const node = nodeAt(descriptor.jsonSchema, ["status"]);
    expect(node.enum).toEqual(["active", "inactive"]);
  });

  test("works without refinements (backward compat)", () => {
    const descriptor = describeSchema(z.object({ x: z.string() }));
    expect(descriptor.jsonSchema).toBeDefined();
    expect(descriptor.validate).toBeDefined();
  });

  test("refinements with labels are reflected in schema", () => {
    const descriptor = describeSchema(
      z.object({ status: z.string() }),
      {
        refinements: [
          {
            path: ["status"],
            enum: ["a", "b"],
            labels: { a: "Alpha", b: "Beta" },
          },
        ],
      },
    );
    const node = nodeAt(descriptor.jsonSchema, ["status"]);
    expect(node["x-enumLabels"]).toEqual({ a: "Alpha", b: "Beta" });
  });
});

describe("validateEnumRefinements", () => {
  test("valid enum value produces no issues", () => {
    const issues = validateEnumRefinements(
      { status: "active" },
      [{ path: ["status"], enum: ["active", "inactive"] }],
    );
    expect(issues).toEqual([]);
  });

  test("invalid enum value produces issue with correct path and message", () => {
    const issues = validateEnumRefinements(
      { status: "unknown" },
      [{ path: ["status"], enum: ["active", "inactive"] }],
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("invalid_value");
    expect(issues[0].path).toEqual(["status"]);
    expect(issues[0].message).toContain("active");
    expect(issues[0].message).toContain("inactive");
  });

  test("array items each get correct runtime issue path", () => {
    const issues = validateEnumRefinements(
      {
        items: [
          { type: "valid" },
          { type: "INVALID" },
          { type: "ALSO_INVALID" },
        ],
      },
      [{ path: ["items", "type"], enum: ["valid", "other"] }],
    );
    expect(issues).toHaveLength(2);
    expect(issues[0].path).toEqual(["items", 1, "type"]);
    expect(issues[1].path).toEqual(["items", 2, "type"]);
  });

  test("nested array depth 2 produces correct runtime paths", () => {
    const issues = validateEnumRefinements(
      {
        groups: [
          { items: [{ kind: "a" }, { kind: "BAD" }] },
          { items: [{ kind: "BAD" }] },
        ],
      },
      [{ path: ["groups", "items", "kind"], enum: ["a", "b"] }],
    );
    expect(issues).toHaveLength(2);
    expect(issues[0].path).toEqual(["groups", 0, "items", 1, "kind"]);
    expect(issues[1].path).toEqual(["groups", 1, "items", 0, "kind"]);
  });

  test("empty enum produces no issues (no-op)", () => {
    const issues = validateEnumRefinements(
      { status: "anything" },
      [{ path: ["status"], enum: [] }],
    );
    expect(issues).toEqual([]);
  });

  test("null at target path is not flagged", () => {
    const issues = validateEnumRefinements(
      { status: null },
      [{ path: ["status"], enum: ["a", "b"] }],
    );
    expect(issues).toEqual([]);
  });

  test("missing path segment is silently skipped", () => {
    const issues = validateEnumRefinements(
      { other: "value" },
      [{ path: ["status"], enum: ["a", "b"] }],
    );
    expect(issues).toEqual([]);
  });
});

describe("descriptor.validate with refinements", () => {
  test("accepts valid enum value", () => {
    const descriptor = describeSchema(z.object({ status: z.string() }), {
      refinements: [{ path: ["status"], enum: ["active", "inactive"] }],
    });
    const result = descriptor.validate({ status: "active" });
    expect(result.success).toBe(true);
  });

  test("rejects invalid enum value", () => {
    const descriptor = describeSchema(z.object({ status: z.string() }), {
      refinements: [{ path: ["status"], enum: ["active", "inactive"] }],
    });
    const result = descriptor.validate({ status: "WRONG" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["status"]);
    }
  });

  test("base schema issues are preserved alongside refinement issues", () => {
    const descriptor = describeSchema(
      z.object({ status: z.string(), count: z.number() }),
      { refinements: [{ path: ["status"], enum: ["a", "b"] }] },
    );
    const result = descriptor.validate({ status: "INVALID", count: "not-a-number" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
      const paths = result.error.issues.map((i) => i.path);
      expect(paths).toContainEqual(["count"]);
      expect(paths).toContainEqual(["status"]);
    }
  });
});
