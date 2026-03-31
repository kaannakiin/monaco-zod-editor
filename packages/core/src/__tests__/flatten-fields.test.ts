import { describe, test, expect } from "vitest";
import { entriesToPointerMap } from "../flatten-fields.js";

describe("entriesToPointerMap", () => {
  test("converts entry list to pointer-keyed map", () => {
    const entries = [
      { path: ["name"], title: "Name" },
      { path: ["address", "street"], title: "Street" },
    ];
    expect(entriesToPointerMap(entries)).toEqual({
      "/name": { title: "Name" },
      "/address/street": { title: "Street" },
    });
  });

  test("returns empty object for empty array", () => {
    expect(entriesToPointerMap([])).toEqual({});
  });

  test("skips entries with empty path (root)", () => {
    const entries = [
      { path: [] as string[], title: "Root" },
      { path: ["name"], title: "Name" },
    ];
    expect(entriesToPointerMap(entries)).toEqual({
      "/name": { title: "Name" },
    });
  });

  test("preserves all FieldMetadata properties", () => {
    const entries = [
      {
        path: ["node"],
        title: "Node",
        description: "A tree node",
        examples: [{ id: "1" }],
        placeholder: "Enter node",
        enumLabels: { a: "Label A" },
        emptyStateHint: "Add a node",
      },
    ];
    expect(entriesToPointerMap(entries)).toEqual({
      "/node": {
        title: "Node",
        description: "A tree node",
        examples: [{ id: "1" }],
        placeholder: "Enter node",
        enumLabels: { a: "Label A" },
        emptyStateHint: "Add a node",
      },
    });
  });

  test("handles multiple entries with nested paths", () => {
    const entries = [
      { path: ["a"], title: "A" },
      { path: ["a", "b"], title: "B" },
      { path: ["a", "b", "c"], title: "C" },
    ];
    expect(entriesToPointerMap(entries)).toEqual({
      "/a": { title: "A" },
      "/a/b": { title: "B" },
      "/a/b/c": { title: "C" },
    });
  });
});
