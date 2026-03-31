import { describe, test, expectTypeOf } from "vitest";
import type { SchemaPath } from "../types.js";

describe("SchemaPath type-level tests", () => {
  test("generates top-level keys for flat object", () => {
    type T = { name: string; age: number };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["name"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["age"]>().toMatchTypeOf<Paths>();
    // @ts-expect-error - "missing" is not a valid key
    expectTypeOf<readonly ["missing"]>().toMatchTypeOf<Paths>();
  });

  test("generates nested paths", () => {
    type T = { address: { street: string; city: string } };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["address"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["address", "street"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["address", "city"]>().toMatchTypeOf<Paths>();
    // @ts-expect-error - "zip" does not exist
    expectTypeOf<readonly ["address", "zip"]>().toMatchTypeOf<Paths>();
  });

  test("traverses arrays into element type (no numeric index)", () => {
    type T = { items: { name: string; value: number }[] };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["items"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["items", "name"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["items", "value"]>().toMatchTypeOf<Paths>();
  });

  test("handles optional fields", () => {
    type T = { meta?: { label: string } };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["meta"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["meta", "label"]>().toMatchTypeOf<Paths>();
  });

  test("handles nullable fields", () => {
    type T = { owner: { name: string; email: string } | null };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["owner"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["owner", "name"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["owner", "email"]>().toMatchTypeOf<Paths>();
  });

  test("handles discriminated unions (all branches reachable)", () => {
    type T = {
      content:
        | { kind: "text"; body: string }
        | { kind: "binary"; sizeBytes: number };
    };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["content"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "kind"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "body"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "sizeBytes"]>().toMatchTypeOf<Paths>();
  });

  test("depth-caps recursive types", () => {
    type TreeNode = {
      id: string;
      children: TreeNode[];
    };
    type Paths = SchemaPath<TreeNode>;
    // First few levels should work
    expectTypeOf<readonly ["id"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["children"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["children", "id"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["children", "children"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["children", "children", "id"]>().toMatchTypeOf<Paths>();
  });

  test("deeply nested non-recursive object up to depth 8", () => {
    type T = {
      a: { b: { c: { d: { e: { f: { g: string } } } } } };
    };
    type Paths = SchemaPath<T>;
    // depth 1-7 should all work
    expectTypeOf<readonly ["a"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["a", "b"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["a", "b", "c"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["a", "b", "c", "d"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["a", "b", "c", "d", "e"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["a", "b", "c", "d", "e", "f"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["a", "b", "c", "d", "e", "f", "g"]>().toMatchTypeOf<Paths>();
  });

  test("nested arrays skip all index levels", () => {
    type T = { matrix: { value: number }[][] };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["matrix"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["matrix", "value"]>().toMatchTypeOf<Paths>();
  });

  test("Record<string, V> allows any string key at that level", () => {
    type T = { attrs: Record<string, { score: number }> };
    type Paths = SchemaPath<T>;
    expectTypeOf<readonly ["attrs"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["attrs", "anything"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["attrs", "anything", "score"]>().toMatchTypeOf<Paths>();
  });

  test("complex TreeNode type used in the codebase", () => {
    type TreeNode = {
      id: string;
      label: string;
      nodeType: "folder" | "file" | "symlink";
      metadata: {
        createdAt: string;
        permissions: ("read" | "write" | "execute")[];
        owner: { name: string; email: string } | null;
      };
      attributes: Record<string, string | number | boolean>;
      content:
        | { kind: "text"; body: string; encoding: "utf-8" | "ascii" | "base64" }
        | { kind: "binary"; sizeBytes: number; checksum: string }
        | { kind: "link"; target: string };
      tags: [string, ...string[]];
      priority: number | null;
      children: TreeNode[];
    };
    type Paths = SchemaPath<TreeNode>;

    // top-level keys
    expectTypeOf<readonly ["id"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["label"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["nodeType"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["metadata"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["tags"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["priority"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["children"]>().toMatchTypeOf<Paths>();

    // nested metadata paths
    expectTypeOf<readonly ["metadata", "createdAt"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["metadata", "permissions"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["metadata", "owner"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["metadata", "owner", "name"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["metadata", "owner", "email"]>().toMatchTypeOf<Paths>();

    // discriminated union content branches
    expectTypeOf<readonly ["content", "kind"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "body"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "encoding"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "sizeBytes"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "checksum"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["content", "target"]>().toMatchTypeOf<Paths>();

    // recursive children - second level
    expectTypeOf<readonly ["children", "id"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["children", "metadata", "owner", "name"]>().toMatchTypeOf<Paths>();
    expectTypeOf<readonly ["children", "content", "body"]>().toMatchTypeOf<Paths>();

    // recursive children - third level
    expectTypeOf<readonly ["children", "children", "id"]>().toMatchTypeOf<Paths>();
  });
});
