import { describe, test, expect } from "vitest";
import { isFieldReadOnly } from "../read-only.js";
import type { ResolvedMetadata } from "../types.js";

function meta(
  opts: { readOnly?: boolean; readOnlyPaths?: string[] } = {},
): ResolvedMetadata {
  return {
    fields: {},
    ...(opts.readOnly ? { readOnly: true } : {}),
    ...(opts.readOnlyPaths?.length
      ? { readOnlyPaths: new Set(opts.readOnlyPaths) }
      : {}),
  };
}

describe("isFieldReadOnly", () => {
  describe("root-level readOnly", () => {
    test("locks every path when root readOnly is true", () => {
      const m = meta({ readOnly: true });
      expect(isFieldReadOnly(m, [])).toBe(true);
      expect(isFieldReadOnly(m, ["foo"])).toBe(true);
      expect(isFieldReadOnly(m, ["foo", "bar"])).toBe(true);
      expect(isFieldReadOnly(m, ["items", 0, "name"])).toBe(true);
    });

    test("does not lock when root readOnly is absent", () => {
      const m = meta();
      expect(isFieldReadOnly(m, ["foo"])).toBe(false);
    });
  });

  describe("field-level readOnly", () => {
    test("locks exact field", () => {
      const m = meta({ readOnlyPaths: ["/status"] });
      expect(isFieldReadOnly(m, ["status"])).toBe(true);
    });

    test("does not lock sibling fields", () => {
      const m = meta({ readOnlyPaths: ["/status"] });
      expect(isFieldReadOnly(m, ["name"])).toBe(false);
      expect(isFieldReadOnly(m, ["description"])).toBe(false);
    });

    test("does not lock parent of locked field", () => {
      const m = meta({ readOnlyPaths: ["/metadata/createdAt"] });
      expect(isFieldReadOnly(m, ["metadata"])).toBe(false);
    });
  });

  describe("ancestor propagation", () => {
    test("locks nested child when parent is locked", () => {
      const m = meta({ readOnlyPaths: ["/metadata"] });
      expect(isFieldReadOnly(m, ["metadata", "createdAt"])).toBe(true);
      expect(isFieldReadOnly(m, ["metadata", "owner", "email"])).toBe(true);
    });

    test("locks deeply nested children", () => {
      const m = meta({ readOnlyPaths: ["/config"] });
      expect(isFieldReadOnly(m, ["config", "a", "b", "c"])).toBe(true);
    });
  });

  describe("array item handling", () => {
    test("locks array items when array field is locked", () => {
      const m = meta({ readOnlyPaths: ["/children"] });
      expect(isFieldReadOnly(m, ["children", 0])).toBe(true);
      expect(isFieldReadOnly(m, ["children", 1])).toBe(true);
      expect(isFieldReadOnly(m, ["children", 0, "label"])).toBe(true);
    });

    test("locks nested array item children", () => {
      const m = meta({ readOnlyPaths: ["/items"] });
      expect(isFieldReadOnly(m, ["items", 0, "sub", 1, "name"])).toBe(true);
    });

    test("does not lock unrelated paths when array is locked", () => {
      const m = meta({ readOnlyPaths: ["/items"] });
      expect(isFieldReadOnly(m, ["other"])).toBe(false);
    });
  });

  describe("multiple locked paths", () => {
    test("locks fields from different paths independently", () => {
      const m = meta({ readOnlyPaths: ["/status", "/metadata/createdAt"] });
      expect(isFieldReadOnly(m, ["status"])).toBe(true);
      expect(isFieldReadOnly(m, ["metadata", "createdAt"])).toBe(true);
      expect(isFieldReadOnly(m, ["metadata", "updatedAt"])).toBe(false);
      expect(isFieldReadOnly(m, ["name"])).toBe(false);
    });
  });

  describe("empty path", () => {
    test("empty path is not locked by field-level locks", () => {
      const m = meta({ readOnlyPaths: ["/status"] });
      expect(isFieldReadOnly(m, [])).toBe(false);
    });
  });
});
