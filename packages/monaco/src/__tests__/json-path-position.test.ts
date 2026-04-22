import { describe, test, expect } from "vitest";
import {
  resolveJsonPath,
  resolvePathAtOffset,
  collectPathsInRange,
  getValueContext,
} from "../json-path-position.js";

describe("resolveJsonPath", () => {
  test("resolves root path to full text range", () => {
    const text = '{"a": 1}';
    const range = resolveJsonPath(text, []);
    expect(range).toEqual({ start: 0, end: text.length });
  });

  test("resolves object key to value range", () => {
    const text = '{"name": "Alice"}';
    const range = resolveJsonPath(text, ["name"]);
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe('"Alice"');
  });

  test("resolves nested key", () => {
    const text = '{"a": {"b": 42}}';
    const range = resolveJsonPath(text, ["a", "b"]);
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe("42");
  });

  test("resolves array index", () => {
    const text = '{"items": [10, 20, 30]}';
    const range = resolveJsonPath(text, ["items", 1]);
    expect(range).not.toBeNull();
    expect(text.slice(range!.start, range!.end)).toBe("20");
  });

  test("returns null for missing key", () => {
    expect(resolveJsonPath('{"a": 1}', ["missing"])).toBeNull();
  });

  test("returns null for out-of-bounds array index", () => {
    expect(resolveJsonPath("[1, 2]", [5])).toBeNull();
  });

  test("handles escaped string key", () => {
    const text = '{"key\\nval": 1}';
    const range = resolveJsonPath(text, ["key\nval"]);
    expect(range).not.toBeNull();
  });

  test("handles unicode escape in key lookup", () => {
    const t = '{"key\\u0041": 1}';
    expect(resolveJsonPath(t, ["keyA"])).not.toBeNull();
  });
});

describe("resolvePathAtOffset", () => {
  test("resolves path for cursor in object value", () => {
    const text = '{"name": "Alice", "age": 30}';
    const result = resolvePathAtOffset(text, 10);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["name"]);
  });

  test("resolves path for cursor on key", () => {
    const text = '{"name": "Alice"}';
    const result = resolvePathAtOffset(text, 2);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["name"]);
  });

  test("returns key offset range", () => {
    const text = '{"name": "Alice"}';
    const result = resolvePathAtOffset(text, 2);
    expect(result!.keyStart).toBe(1);
    expect(result!.keyEnd).toBe(7);
    expect(text.slice(result!.keyStart, result!.keyEnd)).toBe('"name"');
  });

  test("resolves nested path", () => {
    const text = '{"a": {"b": 42}}';
    const result = resolvePathAtOffset(text, 12);
    expect(result!.path).toEqual(["a", "b"]);
  });

  test("resolves array path", () => {
    const text = '{"items": [10, 20]}';
    const result = resolvePathAtOffset(text, 15);
    expect(result!.path).toEqual(["items", 1]);
  });

  test("returns null for offset outside structure", () => {
    expect(resolvePathAtOffset('{"a": 1}', 100)).toBeNull();
  });

  test("gap between { and first key resolves to first key", () => {
    const text = '{\n  "id": "val",\n  "label": "src"\n}';
    expect(resolvePathAtOffset(text, 1)?.path).toEqual(["id"]);
    expect(resolvePathAtOffset(text, 2)?.path).toEqual(["id"]);
    expect(resolvePathAtOffset(text, 3)?.path).toEqual(["id"]);
  });

  test("gap between two keys resolves to previous key", () => {
    const text =
      '{\n  "id": "550e8400-e29b-41d4-a716-446655440000",\n  "label": "src"\n}';
    const commaOffset = text.indexOf(",");
    expect(resolvePathAtOffset(text, commaOffset)?.path).toEqual(["id"]);
    expect(resolvePathAtOffset(text, commaOffset + 1)?.path).toEqual(["id"]);
    expect(resolvePathAtOffset(text, commaOffset + 2)?.path).toEqual(["id"]);
  });
});

describe("collectPathsInRange", () => {
  test("returns [] for zero-length range", () => {
    expect(collectPathsInRange('{"a":1}', 2, 0)).toEqual([]);
  });

  test("returns [] for out-of-bounds offset", () => {
    expect(collectPathsInRange('{"a":1}', 100, 5)).toEqual([]);
  });

  test("returns [] for empty text", () => {
    expect(collectPathsInRange("", 0, 1)).toEqual([]);
  });

  test("captures single field whose value overlaps range", () => {
    const text = '{"name":"Alice","age":30}';
    const start = text.indexOf('"Alice"');
    const result = collectPathsInRange(text, start, '"Alice"'.length);
    expect(result).toContainEqual(["name"]);
    expect(result).not.toContainEqual(["age"]);
  });

  test("captures both fields when range spans full object", () => {
    const text = '{"a":1,"b":2}';
    const result = collectPathsInRange(text, 0, text.length);
    expect(result).toContainEqual(["a"]);
    expect(result).toContainEqual(["b"]);
  });

  test("does not capture fields outside the range", () => {
    const text = '{"a":1,"b":2,"c":3}';
    const bStart = text.indexOf('"b"');
    const bVal = text.indexOf("2");
    const result = collectPathsInRange(text, bStart, bVal - bStart + 1);
    expect(result).toContainEqual(["b"]);
    expect(result).not.toContainEqual(["a"]);
    expect(result).not.toContainEqual(["c"]);
  });

  test("recurses into nested object and collects child paths", () => {
    const text = '{"meta":{"createdAt":"2024"}}';
    const result = collectPathsInRange(text, 0, text.length);
    expect(result).toContainEqual(["meta"]);
    expect(result).toContainEqual(["meta", "createdAt"]);
  });

  test("handles array items", () => {
    const text = '{"items":["a","b","c"]}';
    const bStart = text.indexOf('"b"');
    const result = collectPathsInRange(text, bStart, '"b"'.length);
    expect(result).toContainEqual(["items", 1]);
    expect(result).not.toContainEqual(["items", 0]);
    expect(result).not.toContainEqual(["items", 2]);
  });

  test("recurses into array of objects", () => {
    const text = '{"items":[{"id":"x"},{"id":"y"}]}';
    const result = collectPathsInRange(text, 0, text.length);
    expect(result).toContainEqual(["items", 0, "id"]);
    expect(result).toContainEqual(["items", 1, "id"]);
  });

  test("multi-line range spanning unlocked fields then locked descendant returns locked path", () => {
    const text = JSON.stringify(
      { label: "src", nodeType: "folder", metadata: { createdAt: "2026-03-13" } },
      null,
      2,
    );
    const rangeStart = text.indexOf('"label"');
    const createdAtValueEnd =
      text.indexOf('"2026-03-13"') + '"2026-03-13"'.length;
    const result = collectPathsInRange(
      text,
      rangeStart,
      createdAtValueEnd - rangeStart,
    );
    expect(result).toContainEqual(["metadata", "createdAt"]);
  });
});

describe("getValueContext", () => {
  test("returns context for string value", () => {
    const text = '{"name": "Alice"}';
    const ctx = getValueContext(text, 10);
    expect(ctx).not.toBeNull();
    expect(ctx!.path).toEqual(["name"]);
    expect(ctx!.insideString).toBe(true);
  });

  test("returns context for number value", () => {
    const text = '{"age": 30}';
    const ctx = getValueContext(text, 8);
    expect(ctx).not.toBeNull();
    expect(ctx!.path).toEqual(["age"]);
    expect(ctx!.insideString).toBe(false);
  });

  test("returns context for array element", () => {
    const text = '{"items": ["a", "b"]}';
    const ctx = getValueContext(text, 17);
    expect(ctx).not.toBeNull();
    expect(ctx!.path).toEqual(["items", 1]);
    expect(ctx!.insideString).toBe(true);
  });

  test("returns null outside structure", () => {
    expect(getValueContext('{"a": 1}', 100)).toBeNull();
  });
});

describe("typed path segments", () => {
  test("object keys are strings, even if numeric-looking", () => {
    const text = '{"0": "zero", "1": "one"}';
    const r0 = resolvePathAtOffset(text, 7);
    expect(r0!.path).toEqual(["0"]);
    expect(typeof r0!.path[0]).toBe("string");
  });

  test("array indices are numbers", () => {
    const text = '["a", "b", "c"]';
    const r = resolvePathAtOffset(text, 7);
    expect(r!.path).toEqual([1]);
    expect(typeof r!.path[0]).toBe("number");
  });

  test("mixed object/array nesting preserves types", () => {
    const text = '{"items": [{"0": "x"}]}';
    const xStart = text.indexOf('"x"');
    const r = resolvePathAtOffset(text, xStart + 1);
    expect(r!.path).toEqual(["items", 0, "0"]);
    expect(typeof r!.path[0]).toBe("string");
    expect(typeof r!.path[1]).toBe("number");
    expect(typeof r!.path[2]).toBe("string");
  });

  test("getValueContext returns typed segments", () => {
    const text = '{"arr": [{"key": "val"}]}';
    const valStart = text.indexOf('"val"');
    const ctx = getValueContext(text, valStart + 1);
    expect(ctx!.path).toEqual(["arr", 0, "key"]);
    expect(typeof ctx!.path[1]).toBe("number");
  });

  test("deeply nested path preserves segment types", () => {
    const text = '{"a": [{"b": [{"c": 42}]}]}';
    const pos42 = text.indexOf("42");
    const r = resolvePathAtOffset(text, pos42);
    expect(r!.path).toEqual(["a", 0, "b", 0, "c"]);
  });
});
