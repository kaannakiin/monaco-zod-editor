import type { $ZodIssue } from "zod/v4/core";
import { resolveJsonSchemaNode } from "./resolve-json-schema-metadata.js";

/**
 * Applies enum refinements to a JSON Schema object in-place.
 * Each refinement injects an `enum` array (and optional `x-enumLabels`)
 * into the resolved target node.
 *
 * - Empty enum → silently skipped (no-op)
 * - Path not found → throws Error
 * - Incompatible target (object/array) → throws Error
 */
export function applyEnumRefinements(
  jsonSchema: Record<string, unknown>,
  refinements: readonly {
    path: readonly string[];
    enum: readonly string[];
    labels?: Record<string, string>;
  }[],
): void {
  for (const ref of refinements) {
    if (ref.enum.length === 0) continue;

    const node = resolveJsonSchemaNode(jsonSchema, ref.path as string[]);

    if (!node) {
      throw new Error(
        `Refinement target not found: /${ref.path.join("/")}`,
      );
    }

    const nodeType = node.type;
    if (nodeType === "object" || nodeType === "array") {
      throw new Error(
        `Refinement target /${ref.path.join("/")} has type "${nodeType}" — enum refinements require scalar types`,
      );
    }

    node.enum = [...ref.enum];

    if (ref.labels) {
      node["x-enumLabels"] = { ...ref.labels };
    }
  }
}

function collectEnumViolations(
  data: unknown,
  schemaPath: readonly string[],
  schemaIndex: number,
  runtimePath: PropertyKey[],
  allowed: readonly string[],
  issues: $ZodIssue[],
): void {
  if (schemaIndex === schemaPath.length) {
    if (typeof data === "string" && !allowed.includes(data)) {
      issues.push({
        code: "invalid_value",
        values: [...allowed],
        path: [...runtimePath],
        message: `Invalid enum value. Expected ${allowed.join(" | ")}, received "${data}"`,
        input: data,
      } as $ZodIssue);
    }
    return;
  }

  if (data === null || data === undefined || typeof data !== "object") return;

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      collectEnumViolations(
        data[i],
        schemaPath,
        schemaIndex,
        [...runtimePath, i],
        allowed,
        issues,
      );
    }
    return;
  }

  const key = schemaPath[schemaIndex] as string;
  if (key in (data as Record<string, unknown>)) {
    collectEnumViolations(
      (data as Record<string, unknown>)[key],
      schemaPath,
      schemaIndex + 1,
      [...runtimePath, key],
      allowed,
      issues,
    );
  }
}

/**
 * Walks parsed data and collects issues for enum refinement violations.
 * Handles arrays by iterating all items (with numeric runtime path indices)
 * while the schema path uses only string segments.
 *
 * - Empty enum → silently skipped (no-op)
 * - Null/undefined/non-string values → not flagged (Zod handles type errors)
 */
export function validateEnumRefinements(
  data: unknown,
  refinements: readonly {
    path: readonly string[];
    enum: readonly string[];
  }[],
): $ZodIssue[] {
  const issues: $ZodIssue[] = [];
  for (const ref of refinements) {
    if (ref.enum.length === 0) continue;
    collectEnumViolations(data, ref.path, 0, [], ref.enum, issues);
  }
  return issues;
}
