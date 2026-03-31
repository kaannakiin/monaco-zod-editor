import { describe, test, expect } from "vitest";
import { matchesSchemaPath } from "../path-utils.js";

describe("matchesSchemaPath", () => {
  test("exact match without array indices", () => {
    expect(matchesSchemaPath(["a", "b"], ["a", "b"])).toBe(true);
  });

  test("skips single numeric index", () => {
    expect(matchesSchemaPath(["a", 0, "b"], ["a", "b"])).toBe(true);
  });

  test("skips multiple nested numeric indices", () => {
    expect(
      matchesSchemaPath(["items", 0, "sub", 1, "name"], ["items", "sub", "name"]),
    ).toBe(true);
  });

  test("detects string segment mismatch", () => {
    expect(matchesSchemaPath(["a", "c"], ["a", "b"])).toBe(false);
  });

  test("returns false when runtime path is shorter", () => {
    expect(matchesSchemaPath(["a"], ["a", "b"])).toBe(false);
  });

  test("returns false when schema path is shorter", () => {
    expect(matchesSchemaPath(["a", "b", "c"], ["a", "b"])).toBe(false);
  });

  test("matches empty paths", () => {
    expect(matchesSchemaPath([], [])).toBe(true);
  });

  test("runtime with only numeric segments matches empty schema", () => {
    expect(matchesSchemaPath([0, 1], [])).toBe(true);
  });

  test("numeric string key is NOT skipped (only typeof number)", () => {
    expect(matchesSchemaPath(["items", "0", "name"], ["items", "0", "name"])).toBe(
      true,
    );
    expect(matchesSchemaPath(["items", "0", "name"], ["items", "name"])).toBe(false);
  });
});
