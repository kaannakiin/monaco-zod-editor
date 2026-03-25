import { describe, test, expect } from "vitest";
import { computeJsonDiff } from "../json-diff.js";

describe("computeJsonDiff", () => {
  test("equal primitives produce no diffs", () => {
    expect(computeJsonDiff(1, 1)).toEqual([]);
    expect(computeJsonDiff("a", "a")).toEqual([]);
    expect(computeJsonDiff(null, null)).toEqual([]);
  });

  test("changed primitive at root", () => {
    const diffs = computeJsonDiff("old", "new");
    expect(diffs).toEqual([
      { path: [], pointer: "", action: "changed", oldValue: "old", newValue: "new" },
    ]);
  });

  test("added top-level property", () => {
    const diffs = computeJsonDiff({}, { name: "Alice" });
    expect(diffs).toEqual([
      { path: ["name"], pointer: "/name", action: "added", newValue: "Alice" },
    ]);
  });

  test("removed top-level property", () => {
    const diffs = computeJsonDiff({ name: "Alice" }, {});
    expect(diffs).toEqual([
      { path: ["name"], pointer: "/name", action: "removed", oldValue: "Alice" },
    ]);
  });

  test("changed top-level property", () => {
    const diffs = computeJsonDiff({ age: 30 }, { age: 31 });
    expect(diffs).toEqual([
      { path: ["age"], pointer: "/age", action: "changed", oldValue: 30, newValue: 31 },
    ]);
  });

  test("nested object change", () => {
    const diffs = computeJsonDiff(
      { metadata: { owner: { name: "Alice" } } },
      { metadata: { owner: { name: "Bob" } } },
    );
    expect(diffs).toEqual([
      {
        path: ["metadata", "owner", "name"],
        pointer: "/metadata/owner/name",
        action: "changed",
        oldValue: "Alice",
        newValue: "Bob",
      },
    ]);
  });

  test("array item changed", () => {
    const diffs = computeJsonDiff({ tags: ["a", "b"] }, { tags: ["a", "c"] });
    expect(diffs).toEqual([
      {
        path: ["tags", 1],
        pointer: "/tags/1",
        action: "changed",
        oldValue: "b",
        newValue: "c",
      },
    ]);
  });

  test("array item added", () => {
    const diffs = computeJsonDiff({ tags: ["a"] }, { tags: ["a", "b"] });
    expect(diffs).toEqual([
      {
        path: ["tags", 1],
        pointer: "/tags/1",
        action: "added",
        newValue: "b",
      },
    ]);
  });

  test("array item removed", () => {
    const diffs = computeJsonDiff({ tags: ["a", "b"] }, { tags: ["a"] });
    expect(diffs).toEqual([
      {
        path: ["tags", 1],
        pointer: "/tags/1",
        action: "removed",
        oldValue: "b",
      },
    ]);
  });

  test("type change (string → number) emits changed", () => {
    const diffs = computeJsonDiff({ x: "5" }, { x: 5 });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.action).toBe("changed");
    expect(diffs[0]!.oldValue).toBe("5");
    expect(diffs[0]!.newValue).toBe(5);
  });

  test("type change (object → null)", () => {
    const diffs = computeJsonDiff({ owner: { name: "X" } }, { owner: null });
    expect(diffs).toHaveLength(1);
    expect(diffs[0]!.action).toBe("changed");
    expect(diffs[0]!.pointer).toBe("/owner");
  });

  test("equal objects produce no diffs", () => {
    const val = { a: 1, b: { c: "x" } };
    expect(computeJsonDiff(val, { a: 1, b: { c: "x" } })).toEqual([]);
  });

  test("multiple changes reported", () => {
    const diffs = computeJsonDiff(
      { a: 1, b: 2, c: 3 },
      { a: 1, b: 9, d: 4 },
    );
    const actions = Object.fromEntries(diffs.map((d) => [d.path[0], d.action]));
    expect(actions["b"]).toBe("changed");
    expect(actions["c"]).toBe("removed");
    expect(actions["d"]).toBe("added");
  });

  test("JSON Pointer escapes slash in key", () => {
    const diffs = computeJsonDiff({ "a/b": 1 }, { "a/b": 2 });
    expect(diffs[0]!.pointer).toBe("/a~1b");
  });

  test("JSON Pointer escapes tilde in key", () => {
    const diffs = computeJsonDiff({ "a~b": 1 }, { "a~b": 2 });
    expect(diffs[0]!.pointer).toBe("/a~0b");
  });
});
