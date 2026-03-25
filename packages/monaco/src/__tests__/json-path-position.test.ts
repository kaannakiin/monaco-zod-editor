import { describe, test, expect } from "vitest";
import {
  resolveJsonPath,
  positionToOffset,
  makePosition,
  resolvePathAtOffset,
  getValueContext,
  LineIndex,
} from "../json-path-position.js";

describe("positionToOffset", () => {
  test("first character", () => {
    expect(positionToOffset('{"a":1}', 1, 1)).toBe(0);
  });

  test("second line", () => {
    const text = '{\n  "a": 1\n}';
    expect(positionToOffset(text, 2, 3)).toBe(4); // offset of first "
  });

  test("beyond EOF returns text.length", () => {
    expect(positionToOffset("abc", 5, 1)).toBe(3);
  });
});

describe("makePosition", () => {
  test("single line range", () => {
    const text = '{"a": 1}';
    const pos = makePosition(text, 1, 4); // "a"
    expect(pos.startLineNumber).toBe(1);
    expect(pos.startColumn).toBe(2);
    expect(pos.endLineNumber).toBe(1);
    expect(pos.endColumn).toBe(5);
  });

  test("multi-line range", () => {
    const text = '{\n  "a": 1\n}';
    const pos = makePosition(text, 0, text.length);
    expect(pos.startLineNumber).toBe(1);
    expect(pos.startColumn).toBe(1);
    expect(pos.endLineNumber).toBe(3);
    expect(pos.endColumn).toBe(2);
  });
});

describe("resolveJsonPath", () => {
  test("resolves root path", () => {
    const text = '{"a": 1}';
    const pos = resolveJsonPath(text, []);
    expect(pos).not.toBeNull();
    expect(pos!.startLineNumber).toBe(1);
    expect(pos!.startColumn).toBe(1);
  });

  test("resolves object key", () => {
    const text = '{"name": "Alice"}';
    const pos = resolveJsonPath(text, ["name"]);
    expect(pos).not.toBeNull();
    // value starts after `: ` → offset 9, which is `"Alice"`
    expect(pos!.startLineNumber).toBe(1);
  });

  test("resolves nested key", () => {
    const text = '{"a": {"b": 42}}';
    const pos = resolveJsonPath(text, ["a", "b"]);
    expect(pos).not.toBeNull();
  });

  test("resolves array index", () => {
    const text = '{"items": [10, 20, 30]}';
    const pos = resolveJsonPath(text, ["items", 1]);
    expect(pos).not.toBeNull();
  });

  test("returns null for missing key", () => {
    const text = '{"a": 1}';
    expect(resolveJsonPath(text, ["missing"])).toBeNull();
  });

  test("returns null for out-of-bounds array index", () => {
    const text = "[1, 2]";
    expect(resolveJsonPath(text, [5])).toBeNull();
  });

  test("handles escaped string key", () => {
    const text = '{"key\\nval": 1}';
    const pos = resolveJsonPath(text, ["key\nval"]);
    expect(pos).not.toBeNull();
  });
});

describe("resolvePathAtOffset", () => {
  test("resolves path for cursor in object value", () => {
    const text = '{"name": "Alice", "age": 30}';
    // offset 10 is inside "Alice"
    const result = resolvePathAtOffset(text, 10);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["name"]);
  });

  test("resolves path for cursor on key", () => {
    const text = '{"name": "Alice"}';
    // offset 2 is inside "name" key
    const result = resolvePathAtOffset(text, 2);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["name"]);
  });

  test("resolves nested path", () => {
    const text = '{"a": {"b": 42}}';
    // offset 12 is at 42
    const result = resolvePathAtOffset(text, 12);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["a", "b"]);
  });

  test("resolves array path", () => {
    const text = '{"items": [10, 20]}';
    // offset 15 is at 20
    const result = resolvePathAtOffset(text, 15);
    expect(result).not.toBeNull();
    expect(result!.path).toEqual(["items", "1"]);
  });

  test("returns null for offset outside structure", () => {
    const text = '{"a": 1}';
    expect(resolvePathAtOffset(text, 100)).toBeNull();
  });
});

describe("getValueContext", () => {
  test("returns context for string value", () => {
    const text = '{"name": "Alice"}';
    // offset 10 is inside "Alice"
    const ctx = getValueContext(text, 10);
    expect(ctx).not.toBeNull();
    expect(ctx!.path).toEqual(["name"]);
    expect(ctx!.insideString).toBe(true);
  });

  test("returns context for number value", () => {
    const text = '{"age": 30}';
    // offset 8 is at 3 in 30
    const ctx = getValueContext(text, 8);
    expect(ctx).not.toBeNull();
    expect(ctx!.path).toEqual(["age"]);
    expect(ctx!.insideString).toBe(false);
  });

  test("returns context for array element", () => {
    const text = '{"items": ["a", "b"]}';
    // offset 17 is inside "b"
    const ctx = getValueContext(text, 17);
    expect(ctx).not.toBeNull();
    expect(ctx!.path).toEqual(["items", "1"]);
    expect(ctx!.insideString).toBe(true);
  });

  test("returns null outside structure", () => {
    expect(getValueContext('{"a": 1}', 100)).toBeNull();
  });
});

describe("LineIndex", () => {
  const text = '{\n  "a": 1,\n  "b": 2\n}';

  test("positionToOffset matches legacy function", () => {
    const idx = new LineIndex(text);
    expect(idx.positionToOffset(1, 1)).toBe(positionToOffset(text, 1, 1));
    expect(idx.positionToOffset(2, 3)).toBe(positionToOffset(text, 2, 3));
    expect(idx.positionToOffset(3, 1)).toBe(positionToOffset(text, 3, 1));
  });

  test("positionToOffset via optional parameter matches legacy", () => {
    const idx = new LineIndex(text);
    expect(positionToOffset(text, 2, 3, idx)).toBe(
      positionToOffset(text, 2, 3),
    );
  });

  test("makePosition via optional parameter matches legacy", () => {
    const idx = new LineIndex(text);
    expect(makePosition(text, 3, 10, idx)).toEqual(makePosition(text, 3, 10));
  });

  test("offsetToPosition round-trips with positionToOffset", () => {
    const idx = new LineIndex(text);
    const pos = idx.offsetToPosition(5);
    expect(idx.positionToOffset(pos.line, pos.col)).toBe(5);
  });

  test("returns -1 for out-of-range line", () => {
    const idx = new LineIndex(text);
    expect(idx.positionToOffset(100, 1)).toBe(-1);
  });

  test("handles unicode escape in key lookup after fix", () => {
    const t = '{"key\\u0041": 1}';
    const pos = resolveJsonPath(t, ["keyA"]);
    expect(pos).not.toBeNull();
  });
});
