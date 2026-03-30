import { describe, expect, test } from "vitest";
import { describeSchema } from "../describe-schema.js";
import { resolveJsonSchemaNode } from "../resolve-json-schema-metadata.js";
import { resolveFieldContext } from "../resolve-field-context.js";
import {
  buildHoverAuditDescriptor,
  findHoverAuditCase,
  hoverAuditCases,
  hoverAuditStageOrder,
} from "../../test-support/hover-audit-manifest.js";

function assertJsonSchemaNode(
  node: Record<string, unknown> | null,
  expected: Record<string, unknown>,
): void {
  expect(node).not.toBeNull();
  if (!node) return;

  for (const [key, value] of Object.entries(expected)) {
    if (key === "required") continue;
    expect(node[key]).toEqual(value);
  }
}

function assertFieldContext(
  context: ReturnType<typeof resolveFieldContext>,
  expected: {
    type?: unknown;
    format?: unknown;
    pattern?: unknown;
    enum?: unknown;
    nullable?: boolean;
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    minimum?: number;
    maximum?: number;
    properties?: string[];
    metadata?: Record<string, unknown>;
  },
): void {
  if (expected.type !== undefined) {
    expect(context.typeInfo.type).toEqual(expected.type);
  }
  if (expected.format !== undefined) {
    expect(context.typeInfo.format).toEqual(expected.format);
  }
  if (expected.pattern !== undefined) {
    expect(context.typeInfo.pattern).toEqual(expected.pattern);
  }
  if (expected.enum !== undefined) {
    expect(context.typeInfo.enum).toEqual(expected.enum);
  }
  if (expected.nullable !== undefined) {
    expect(context.typeInfo.nullable).toBe(expected.nullable);
  }
  if (expected.required !== undefined) {
    expect(context.required).toBe(expected.required);
  }
  if (expected.minLength !== undefined) {
    expect(context.typeInfo.minLength).toBe(expected.minLength);
  }
  if (expected.maxLength !== undefined) {
    expect(context.typeInfo.maxLength).toBe(expected.maxLength);
  }
  if (expected.minimum !== undefined) {
    expect(context.typeInfo.minimum).toBe(expected.minimum);
  }
  if (expected.maximum !== undefined) {
    expect(context.typeInfo.maximum).toBe(expected.maximum);
  }
  if (expected.properties) {
    expect(context.typeInfo.properties).toEqual(
      expect.arrayContaining(expected.properties),
    );
  }

  if (expected.metadata) {
    expect(context.metadata).toMatchObject(expected.metadata);
  }
}

describe("hover audit manifest", () => {
  test("every manifest case declares all audit stages", () => {
    for (const auditCase of hoverAuditCases) {
      expect(Object.keys(auditCase.stageStatus).sort()).toEqual(
        [...hoverAuditStageOrder].sort(),
      );
    }
  });

  describe("JSON Schema nodes", () => {
    for (const auditCase of hoverAuditCases) {
      test(`${auditCase.id} -> resolveJsonSchemaNode matches manifest`, () => {
        const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
        const node = resolveJsonSchemaNode(
          descriptor.jsonSchema,
          auditCase.hover.path.map(String),
        );

        assertJsonSchemaNode(node, auditCase.expectations.jsonSchemaNode);

        const expectedRequired = auditCase.expectations.jsonSchemaNode.required;
        if (expectedRequired !== undefined) {
          const ctx = resolveFieldContext(descriptor, auditCase.hover.path);
          expect(ctx.required).toBe(expectedRequired);
        }
      });
    }
  });

  describe("field context", () => {
    for (const auditCase of hoverAuditCases) {
      test(`${auditCase.id} -> resolveFieldContext matches manifest`, () => {
        const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
        const context = resolveFieldContext(descriptor, auditCase.hover.path);

        assertFieldContext(context, auditCase.expectations.fieldContext);
      });
    }
  });

  test("nullish owner nested email remains reachable through anyOf", () => {
    const auditCase = findHoverAuditCase("nullish-owner");
    expect(auditCase).not.toBeNull();
    if (!auditCase) return;

    const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
    const emailContext = resolveFieldContext(descriptor, ["owner", "email"]);

    assertFieldContext(emailContext, {
      type: "string",
      format: "email",
      required: true,
      metadata: {
        title: "Owner Email",
        description: "Owner email address",
        placeholder: "owner@example.com",
      },
    });
  });

  test("discriminated union resolves the matching branch-specific field", () => {
    const auditCase = findHoverAuditCase("discriminated-union-body");
    expect(auditCase).not.toBeNull();
    if (!auditCase) return;

    const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);

    const bodyNode = resolveJsonSchemaNode(descriptor.jsonSchema, [
      "content",
      "body",
    ]);
    const srcNode = resolveJsonSchemaNode(descriptor.jsonSchema, [
      "content",
      "src",
    ]);

    expect(bodyNode?.description).toBe("Text body");
    expect(srcNode?.description).toBe("Image source");
  });
});
