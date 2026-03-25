import { describe, test, expect } from "vitest";
import { z, toJSONSchema } from "zod";
import { resolveFieldMetadata } from "../resolve-field-metadata.js";
import type { ResolvedMetadata } from "../types.js";

function schema(s: z.ZodType): Record<string, unknown> {
  return toJSONSchema(s) as Record<string, unknown>;
}

describe("resolveFieldMetadata", () => {
  describe("explicit metadata only", () => {
    const metadata: ResolvedMetadata = {
      fields: {
        name: { title: "Name", description: "User name" },
        "address.street": { title: "Street" },
      },
    };

    test("resolves top-level field", () => {
      const meta = resolveFieldMetadata(metadata, ["name"]);
      expect(meta).toEqual({ title: "Name", description: "User name" });
    });

    test("resolves nested field with dot-notation key", () => {
      const meta = resolveFieldMetadata(metadata, ["address", "street"]);
      expect(meta).toEqual({ title: "Street" });
    });

    test("returns undefined for unknown field", () => {
      expect(resolveFieldMetadata(metadata, ["missing"])).toBeUndefined();
    });
  });

  describe("JSON Schema fallback only", () => {
    const metadata: ResolvedMetadata = { fields: {} };
    const js = schema(
      z.object({ name: z.string().describe("The user name") }),
    );

    test("falls back to JSON Schema description", () => {
      const meta = resolveFieldMetadata(metadata, ["name"], js);
      expect(meta).toBeDefined();
      expect(meta!.description).toBe("The user name");
    });
  });

  describe("merge: explicit wins over fallback", () => {
    const metadata: ResolvedMetadata = {
      fields: {
        name: { title: "Custom Title" },
      },
    };
    const js = schema(
      z.object({ name: z.string().describe("Schema description") }),
    );

    test("explicit title overrides, schema description fills gap", () => {
      const meta = resolveFieldMetadata(metadata, ["name"], js);
      expect(meta).toBeDefined();
      expect(meta!.title).toBe("Custom Title");
      expect(meta!.description).toBe("Schema description");
    });
  });

  describe("root-level metadata", () => {
    const metadata: ResolvedMetadata = {
      title: "Root Title",
      description: "Root Description",
      fields: {},
    };

    test("returns top-level metadata for empty path", () => {
      const meta = resolveFieldMetadata(metadata, []);
      expect(meta).toBeDefined();
      expect(meta!.title).toBe("Root Title");
      expect(meta!.description).toBe("Root Description");
    });
  });

  describe("empty root metadata", () => {
    const metadata: ResolvedMetadata = { fields: {} };

    test("returns undefined for empty path with no top-level metadata", () => {
      expect(resolveFieldMetadata(metadata, [])).toBeUndefined();
    });
  });
});
