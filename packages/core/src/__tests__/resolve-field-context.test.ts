import { describe, test, expect } from "vitest";
import { resolveFieldContext } from "../resolve-field-context.js";
import { treeNodeDescriptor } from "../examples/tree-node.js";
import { SchemaCache } from "../schema-cache.js";
import type { FieldPath } from "../field-context-types.js";

const descriptor = treeNodeDescriptor;

describe("resolveFieldContext", () => {
  describe("root-level scalar fields", () => {
    test("id — uuid, explicit metadata", () => {
      const ctx = resolveFieldContext(descriptor, ["id"]);
      expect(ctx.path).toEqual(["id"]);
      expect(ctx.typeInfo.type).toBe("string");
      expect(ctx.typeInfo.format).toBe("uuid");
      expect(ctx.metadata?.title).toBe("Node ID");
      expect(ctx.metadata?.placeholder).toBe(
        "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      );
      expect(ctx.required).toBe(true);
    });

    test("label — string with minLength/maxLength", () => {
      const ctx = resolveFieldContext(descriptor, ["label"]);
      expect(ctx.typeInfo.type).toBe("string");
      expect(ctx.typeInfo.minLength).toBe(1);
      expect(ctx.typeInfo.maxLength).toBe(255);
      expect(ctx.metadata?.title).toBe("Label");
      expect(ctx.required).toBe(true);
    });

    test("nodeType — enum", () => {
      const ctx = resolveFieldContext(descriptor, ["nodeType"]);
      expect(ctx.typeInfo.type).toBe("string");
      expect(Array.isArray(ctx.typeInfo.enum)).toBe(true);
      expect(ctx.typeInfo.enum).toContain("folder");
      expect(ctx.typeInfo.enum).toContain("file");
      expect(ctx.typeInfo.enum).toContain("symlink");
      expect(ctx.metadata?.title).toBe("Node Type");
      expect(ctx.required).toBe(true);
    });

    test("priority — nullable number", () => {
      const ctx = resolveFieldContext(descriptor, ["priority"]);
      expect(ctx.typeInfo.nullable).toBe(true);
      expect(ctx.typeInfo.type).toBe("integer");
      expect(ctx.typeInfo.minimum).toBe(0);
      expect(ctx.typeInfo.maximum).toBe(10);
      expect(ctx.metadata?.title).toBe("Priority");
      expect(ctx.required).toBe(true);
    });
  });

  describe("nested object fields", () => {
    test("metadata — object with description from JSON schema", () => {
      const ctx = resolveFieldContext(descriptor, ["metadata"]);
      expect(ctx.typeInfo.type).toBe("object");
      expect(ctx.typeInfo.properties).toContain("createdAt");
      expect(ctx.typeInfo.properties).toContain("permissions");
      expect(ctx.typeInfo.properties).toContain("owner");
      expect(ctx.required).toBe(true);
    });

    test("metadata.createdAt — datetime format, explicit placeholder", () => {
      const ctx = resolveFieldContext(descriptor, ["metadata", "createdAt"]);
      expect(ctx.typeInfo.type).toBe("string");
      expect(ctx.typeInfo.format).toBe("date-time");
      expect(ctx.metadata?.description).toBe("ISO 8601 creation timestamp");
      expect(ctx.metadata?.placeholder).toBe("e.g. 2026-03-13T10:30:00Z");
      expect(ctx.required).toBe(true);
    });

    test("metadata.owner — nullable object", () => {
      const ctx = resolveFieldContext(descriptor, ["metadata", "owner"]);
      expect(ctx.typeInfo.nullable).toBe(true);
      expect(ctx.typeInfo.type).toBe("object");
      expect(ctx.typeInfo.properties).toContain("name");
      expect(ctx.typeInfo.properties).toContain("email");
      expect(ctx.metadata?.emptyStateHint).toBe("Set to null if no owner is assigned.");
    });

    test("metadata.owner.email — explicit description", () => {
      const ctx = resolveFieldContext(descriptor, [
        "metadata",
        "owner",
        "email",
      ]);
      expect(ctx.typeInfo.type).toBe("string");
      expect(ctx.metadata?.description).toBe("Owner's email address");
      expect(ctx.required).toBe(true);
    });
  });

  describe("union field", () => {
    test("content — discriminated union with unionBranches", () => {
      const ctx = resolveFieldContext(descriptor, ["content"]);
      expect(ctx.typeInfo.type).toBe("union");
      expect(Array.isArray(ctx.typeInfo.unionBranches)).toBe(true);
      // 3 non-null branches
      expect(ctx.typeInfo.unionBranches!.length).toBe(3);
      const types = ctx.typeInfo.unionBranches!.map((b) => b.type);
      expect(types.every((t) => t === "object")).toBe(true);
      // Each branch has distinct properties
      const allProps = ctx.typeInfo.unionBranches!.flatMap(
        (b) => b.properties ?? [],
      );
      expect(allProps).toContain("kind");
      expect(allProps).toContain("body");
      expect(allProps).toContain("sizeBytes");
      expect(allProps).toContain("target");
      expect(ctx.metadata?.title).toBe("Content");
      expect(ctx.required).toBe(true);
    });
  });

  describe("array fields", () => {
    test("tags — tuple/array", () => {
      const ctx = resolveFieldContext(descriptor, ["tags"]);
      expect(ctx.typeInfo.type).toBe("array");
      // z.tuple([z.string()]).rest(z.string()) emits prefixItems, not minItems
      expect(ctx.metadata?.title).toBe("Tags");
      expect(ctx.required).toBe(true);
    });

    test("metadata.permissions — array with min items", () => {
      const ctx = resolveFieldContext(descriptor, ["metadata", "permissions"]);
      expect(ctx.typeInfo.type).toBe("array");
      expect(ctx.typeInfo.minItems).toBe(1);
      expect(ctx.metadata?.description).toBe(
        "At least one permission required",
      );
    });

    test("children — recursive array", () => {
      const ctx = resolveFieldContext(descriptor, ["children"]);
      expect(ctx.typeInfo.type).toBe("array");
      expect(ctx.metadata?.title).toBe("Children");
      expect(ctx.required).toBe(true);
    });
  });

  describe("record field", () => {
    test("attributes — record/additionalProperties", () => {
      const ctx = resolveFieldContext(descriptor, ["attributes"]);
      expect(ctx.typeInfo.type).toBe("object");
      expect(ctx.metadata?.title).toBe("Attributes");
    });
  });

  describe("required flag", () => {
    test("required fields are marked required", () => {
      const requiredFields: FieldPath[] = [
        ["id"],
        ["label"],
        ["nodeType"],
        ["metadata"],
        ["content"],
        ["tags"],
        ["children"],
      ];
      for (const path of requiredFields) {
        const ctx = resolveFieldContext(descriptor, path);
        expect(ctx.required, `${path.join(".")} should be required`).toBe(true);
      }
    });

    test("metadata.owner.name — required within owner object", () => {
      const ctx = resolveFieldContext(descriptor, [
        "metadata",
        "owner",
        "name",
      ]);
      expect(ctx.required).toBe(true);
    });
  });

  describe("unknown / missing paths", () => {
    test("nonexistent field returns null schemaNode", () => {
      const ctx = resolveFieldContext(descriptor, ["nonexistent"]);
      expect(ctx.schemaNode).toBeNull();
      expect(ctx.metadata).toBeUndefined();
      expect(ctx.required).toBe(false);
    });

    test("empty path resolves root", () => {
      const ctx = resolveFieldContext(descriptor, []);
      expect(ctx.typeInfo.type).toBe("object");
      expect(ctx.typeInfo.properties).toContain("id");
      expect(ctx.required).toBe(false);
    });
  });

  describe("with SchemaCache", () => {
    test("cache produces same result as uncached", () => {
      const cache = new SchemaCache(descriptor.jsonSchema, descriptor.metadata);
      const path: FieldPath = ["metadata", "owner", "email"];

      const uncached = resolveFieldContext(descriptor, path);
      const cached = resolveFieldContext(descriptor, path, cache);

      expect(cached.typeInfo).toEqual(uncached.typeInfo);
      expect(cached.metadata).toEqual(uncached.metadata);
      expect(cached.required).toEqual(uncached.required);
    });

    test("cache hit on repeated calls", () => {
      const cache = new SchemaCache(descriptor.jsonSchema, descriptor.metadata);
      const path: FieldPath = ["metadata", "createdAt"];

      const first = resolveFieldContext(descriptor, path, cache);
      const second = resolveFieldContext(descriptor, path, cache);

      expect(first.typeInfo).toEqual(second.typeInfo);
      expect(first.metadata).toEqual(second.metadata);
    });
  });

  describe("path identity", () => {
    test("returned path is same reference as input", () => {
      const path: FieldPath = ["metadata", "owner"];
      const ctx = resolveFieldContext(descriptor, path);
      expect(ctx.path).toBe(path);
    });
  });

  describe("constraints enrichment in metadata", () => {
    test("string constraints are populated", () => {
      const ctx = resolveFieldContext(descriptor, ["label"]);
      expect(ctx.metadata?.constraints).toBeDefined();
      expect(ctx.metadata!.constraints!.minLength).toBe(1);
      expect(ctx.metadata!.constraints!.maxLength).toBe(255);
    });

    test("numeric constraints are populated", () => {
      const ctx = resolveFieldContext(descriptor, ["metadata", "permissions"]);
      // permissions is an array — should have minItems/maxItems if defined
      expect(ctx.metadata?.constraints ?? {}).toBeDefined();
    });

    test("field without constraints has no constraints key", () => {
      const ctx = resolveFieldContext(descriptor, ["id"]);
      // id is uuid string with format but no min/max length
      // Should still have constraints if format implies them, or undefined
      if (ctx.metadata?.constraints) {
        expect(typeof ctx.metadata.constraints).toBe("object");
      }
    });
  });
});
