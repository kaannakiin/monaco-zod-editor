import { describe, test, expect } from "vitest";
import { z } from "zod";
import { describeSchema } from "../describe-schema.js";
import { isFieldReadOnly } from "../read-only.js";
import { resolveFieldContext } from "../resolve-field-context.js";
import { buildFieldCatalog } from "../field-catalog.js";
import type { FieldPath } from "../field-context-types.js";
import type { ResolvedMetadata, FieldMetadataEntry } from "../types.js";



/** Flat object with N string fields */
function flatSchema(n: number) {
  const shape: Record<string, z.ZodString> = {};
  for (let i = 0; i < n; i++) shape[`field_${i}`] = z.string();
  return z.object(shape);
}

/** Deeply nested object: depth levels, each with `width` sibling fields */
function deepSchema(depth: number, width: number): z.ZodType {
  if (depth === 0) return z.string();
  const shape: Record<string, z.ZodType> = {};
  for (let i = 0; i < width; i++) {
    shape[`level_${depth}_field_${i}`] = deepSchema(depth - 1, width);
  }
  return z.object(shape);
}

/** Object with N array fields, each containing objects with M properties */
function arraySchema(arrayCount: number, itemFieldCount: number) {
  const shape: Record<string, z.ZodType> = {};
  for (let i = 0; i < arrayCount; i++) {
    const itemShape: Record<string, z.ZodString> = {};
    for (let j = 0; j < itemFieldCount; j++) {
      itemShape[`prop_${j}`] = z.string();
    }
    shape[`list_${i}`] = z.array(z.object(itemShape));
  }
  return z.object(shape);
}



function time(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

function timeAvg(fn: () => void, iterations: number): number {
  
  fn();
  fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    times.push(time(fn));
  }
  return times.reduce((a, b) => a + b, 0) / times.length;
}



describe("read-only performance", () => {
  describe("isFieldReadOnly — raw function", () => {
    test("100 fields, 20 readOnly paths, 10K lookups", () => {
      const readOnlyPaths: string[] = [];
      for (let i = 0; i < 20; i++) readOnlyPaths.push(`/field_${i * 5}`);

      const m: ResolvedMetadata = {
        fields: {},
        readOnlyPaths: new Set(readOnlyPaths),
      };

      const paths: FieldPath[] = [];
      for (let i = 0; i < 100; i++) paths.push([`field_${i}`]);

      const ms = timeAvg(() => {
        for (let iter = 0; iter < 100; iter++) {
          for (const p of paths) isFieldReadOnly(m, p);
        }
      }, 10);

      console.log(`  10K isFieldReadOnly (flat): ${ms.toFixed(3)}ms`);
      expect(ms).toBeLessThan(50);
    });

    test("deep paths (depth 8), 50 readOnly ancestors, 10K lookups", () => {
      const readOnlyPaths: string[] = [];
      for (let i = 0; i < 50; i++) readOnlyPaths.push(`/level_8_field_0/level_7_field_${i % 3}`);

      const m: ResolvedMetadata = {
        fields: {},
        readOnlyPaths: new Set(readOnlyPaths),
      };

      const deepPath: FieldPath = [
        "level_8_field_0", "level_7_field_0", "level_6_field_0",
        "level_5_field_0", "level_4_field_0", "level_3_field_0",
        "level_2_field_0", "level_1_field_0",
      ];

      const ms = timeAvg(() => {
        for (let i = 0; i < 10000; i++) isFieldReadOnly(m, deepPath);
      }, 10);

      console.log(`  10K isFieldReadOnly (depth 8): ${ms.toFixed(3)}ms`);
      expect(ms).toBeLessThan(50);
    });

    test("array paths with numeric index skipping, 10K lookups", () => {
      const readOnlyPaths = ["/items", "/metadata/tags"];
      const m: ResolvedMetadata = {
        fields: {},
        readOnlyPaths: new Set(readOnlyPaths),
      };

      const paths: FieldPath[] = [];
      for (let i = 0; i < 100; i++) {
        paths.push(["items", i, "name"]);
        paths.push(["metadata", "tags", i, "label"]);
      }

      const ms = timeAvg(() => {
        for (let iter = 0; iter < 50; iter++) {
          for (const p of paths) isFieldReadOnly(m, p);
        }
      }, 10);

      console.log(`  10K isFieldReadOnly (array): ${ms.toFixed(3)}ms`);
      expect(ms).toBeLessThan(50);
    });
  });

  describe("resolveFieldContext — full pipeline", () => {
    test("100-field flat schema, 20 readOnly, 1K context resolutions", () => {
      const schema = flatSchema(100);
      const fields: FieldMetadataEntry[] = [];
      for (let i = 0; i < 20; i++) {
        fields.push({ path: [`field_${i * 5}`] as readonly string[], readOnly: true });
      }
      const descriptor = describeSchema(schema, { metadata: { fields } });

      const paths: FieldPath[] = [];
      for (let i = 0; i < 100; i++) paths.push([`field_${i}`]);

      const ms = timeAvg(() => {
        for (let iter = 0; iter < 10; iter++) {
          for (const p of paths) resolveFieldContext(descriptor, p);
        }
      }, 5);

      console.log(`  1K resolveFieldContext (100 fields): ${ms.toFixed(3)}ms`);
      expect(ms).toBeLessThan(200);
    });

    test("deep nested schema (depth 6 x width 3), 500 context resolutions", () => {
      const schema = deepSchema(6, 3);
      const descriptor = describeSchema(schema, {
        metadata: {
          fields: [
            { path: ["level_6_field_0", "level_5_field_0"] as readonly string[], readOnly: true },
          ],
        },
      });

      const paths: FieldPath[] = [
        ["level_6_field_0"],
        ["level_6_field_0", "level_5_field_0"],
        ["level_6_field_0", "level_5_field_0", "level_4_field_0"],
        ["level_6_field_0", "level_5_field_1"],
        ["level_6_field_1"],
      ];

      const ms = timeAvg(() => {
        for (let iter = 0; iter < 100; iter++) {
          for (const p of paths) resolveFieldContext(descriptor, p);
        }
      }, 5);

      console.log(`  500 resolveFieldContext (deep 6x3): ${ms.toFixed(3)}ms`);
      expect(ms).toBeLessThan(200);
    });
  });

  describe("buildFieldCatalog — full catalog with readOnly", () => {
    test("100-field flat schema with 20 readOnly fields", () => {
      const schema = flatSchema(100);
      const fields: FieldMetadataEntry[] = [];
      for (let i = 0; i < 20; i++) {
        fields.push({ path: [`field_${i * 5}`] as readonly string[], readOnly: true });
      }
      const descriptor = describeSchema(schema, { metadata: { fields } });

      const ms = timeAvg(() => {
        buildFieldCatalog(descriptor);
      }, 10);

      const catalog = buildFieldCatalog(descriptor);
      const lockedCount = catalog.fields.filter((f) => f.readOnly).length;

      console.log(`  buildFieldCatalog (100 fields): ${ms.toFixed(3)}ms, ${lockedCount} locked`);
      expect(ms).toBeLessThan(100);
      expect(lockedCount).toBe(20);
    });

    test("10 arrays x 10 item fields with 3 readOnly arrays", () => {
      const schema = arraySchema(10, 10);
      const fields: FieldMetadataEntry[] = [
        { path: ["list_0"] as readonly string[], readOnly: true },
        { path: ["list_3"] as readonly string[], readOnly: true },
        { path: ["list_7"] as readonly string[], readOnly: true },
      ];
      const descriptor = describeSchema(schema, { metadata: { fields } });

      const ms = timeAvg(() => {
        buildFieldCatalog(descriptor);
      }, 10);

      console.log(`  buildFieldCatalog (10x10 array): ${ms.toFixed(3)}ms`);
      expect(ms).toBeLessThan(200);
    });

    test("deep schema (depth 5 x width 4) with root subtree locked", () => {
      const schema = deepSchema(5, 4);
      const descriptor = describeSchema(schema, {
        metadata: {
          readOnly: true,
        },
      });

      const ms = timeAvg(() => {
        buildFieldCatalog(descriptor);
      }, 5);

      const catalog = buildFieldCatalog(descriptor);
      const allLocked = catalog.fields.every((f) => f.readOnly);

      console.log(`  buildFieldCatalog (deep 5x4, root locked): ${ms.toFixed(3)}ms, ${catalog.fields.length} fields`);
      expect(ms).toBeLessThan(500);
      expect(allLocked).toBe(true);
    });
  });

  describe("worst-case: many readOnly paths", () => {
    test("500 readOnly paths, 10K lookups on depth-8 paths", () => {
      const readOnlyPaths: string[] = [];
      for (let i = 0; i < 500; i++) readOnlyPaths.push(`/section_${i}`);

      const m: ResolvedMetadata = {
        fields: {},
        readOnlyPaths: new Set(readOnlyPaths),
      };

      const deepPath: FieldPath = [
        "section_499", "sub_a", "sub_b", "sub_c",
        "sub_d", "sub_e", "sub_f", "leaf",
      ];

      const nonMatchPath: FieldPath = [
        "other_section", "sub_a", "sub_b", "sub_c",
        "sub_d", "sub_e", "sub_f", "leaf",
      ];

      const ms = timeAvg(() => {
        for (let i = 0; i < 5000; i++) {
          isFieldReadOnly(m, deepPath);
          isFieldReadOnly(m, nonMatchPath);
        }
      }, 10);

      console.log(`  10K lookups (500 paths, depth 8): ${ms.toFixed(3)}ms`);
      expect(ms).toBeLessThan(100);
    });
  });
});
