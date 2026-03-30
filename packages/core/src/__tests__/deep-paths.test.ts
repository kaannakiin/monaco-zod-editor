import { describe, test, expectTypeOf } from "vitest";
import { z } from "zod";
import { describeSchema } from "../describe-schema.js";
import type { DeepPaths } from "../types.js";

describe("DeepPaths type-level tests", () => {
  test("generates top-level keys for flat object", () => {
    type T = { name: string; age: number };
    type Paths = DeepPaths<T>;
    expectTypeOf<"name">().toMatchTypeOf<Paths>();
    expectTypeOf<"age">().toMatchTypeOf<Paths>();
    expectTypeOf<"missing">().not.toMatchTypeOf<Paths>();
  });

  test("generates nested paths", () => {
    type T = { address: { street: string; city: string } };
    type Paths = DeepPaths<T>;
    expectTypeOf<"address">().toMatchTypeOf<Paths>();
    expectTypeOf<"address.street">().toMatchTypeOf<Paths>();
    expectTypeOf<"address.city">().toMatchTypeOf<Paths>();
    expectTypeOf<"address.zip">().not.toMatchTypeOf<Paths>();
  });

  test("traverses arrays into element type", () => {
    type T = { items: { name: string; value: number }[] };
    type Paths = DeepPaths<T>;
    expectTypeOf<"items">().toMatchTypeOf<Paths>();
    expectTypeOf<"items.name">().toMatchTypeOf<Paths>();
    expectTypeOf<"items.value">().toMatchTypeOf<Paths>();
  });

  test("handles optional fields", () => {
    type T = { meta?: { label: string } };
    type Paths = DeepPaths<T>;
    expectTypeOf<"meta">().toMatchTypeOf<Paths>();
    expectTypeOf<"meta.label">().toMatchTypeOf<Paths>();
  });

  test("handles nullable fields", () => {
    type T = { owner: { name: string; email: string } | null };
    type Paths = DeepPaths<T>;
    expectTypeOf<"owner">().toMatchTypeOf<Paths>();
    expectTypeOf<"owner.name">().toMatchTypeOf<Paths>();
    expectTypeOf<"owner.email">().toMatchTypeOf<Paths>();
  });

  test("handles discriminated unions", () => {
    type T = {
      content:
        | { kind: "text"; body: string }
        | { kind: "binary"; sizeBytes: number };
    };
    type Paths = DeepPaths<T>;
    expectTypeOf<"content">().toMatchTypeOf<Paths>();
    expectTypeOf<"content.kind">().toMatchTypeOf<Paths>();
    expectTypeOf<"content.body">().toMatchTypeOf<Paths>();
    expectTypeOf<"content.sizeBytes">().toMatchTypeOf<Paths>();
  });

  test("depth-caps recursive types", () => {
    type TreeNode = {
      id: string;
      children: TreeNode[];
    };
    type Paths = DeepPaths<TreeNode>;
    // First few levels should work
    expectTypeOf<"id">().toMatchTypeOf<Paths>();
    expectTypeOf<"children">().toMatchTypeOf<Paths>();
    expectTypeOf<"children.id">().toMatchTypeOf<Paths>();
    expectTypeOf<"children.children">().toMatchTypeOf<Paths>();
    expectTypeOf<"children.children.id">().toMatchTypeOf<Paths>();
  });

  test("describeSchema accepts flat dot-notation with autocomplete", () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string(),
      }),
    });

    // This should type-check — flat dot-notation paths
    const descriptor = describeSchema(schema, {
      metadata: {
        title: "User",
        fields: {
          name: { title: "Name" },
          address: { title: "Address" },
          "address.street": { title: "Street" },
          "address.city": { title: "City" },
        },
      },
    });

    expectTypeOf(descriptor.metadata.fields).toBeObject();
  });

  test("describeSchema accepts nested format with _meta", () => {
    const schema = z.object({
      name: z.string(),
      address: z.object({
        street: z.string(),
        city: z.string(),
      }),
    });

    // This should type-check — nested format
    const descriptor = describeSchema(schema, {
      metadata: {
        title: "User",
        fields: {
          name: { title: "Name" },
          address: {
            _meta: { title: "Address" },
            street: { title: "Street" },
            city: { title: "City" },
          },
        },
      },
    });

    // After flattening, metadata.fields should be flat
    expectTypeOf(descriptor.metadata.fields).toBeObject();
  });
});
