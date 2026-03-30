import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { z } from "../../../core/node_modules/zod/index.js";
import {
  describeSchema,
  resolveFieldContext,
  SchemaCache,
} from "../../../core/src/index.js";
import {
  resolveJsonPath,
  resolvePathAtOffset,
  positionToOffset,
  LineIndex,
} from "../json-path-position.js";
import { attachZodToEditor } from "../attach.js";
import { createZodHoverProvider, formatFieldMetadataHover } from "../hover.js";
import { locales } from "../locale.js";
import {
  buildHoverAuditDescriptor,
  createHoverAuditText,
  findHoverAuditCase,
  hoverAuditCases,
} from "../../../core/test-support/hover-audit-manifest.js";
import {
  createMockEditor,
  createMockModel,
  createMockMonaco,
} from "../../test-support/mock-monaco.js";

function toStringPath(path: Array<string | number>): string[] {
  return path.map(String);
}

function expectOrderedFragments(text: string, fragments: string[]): void {
  let cursor = 0;

  for (const fragment of fragments) {
    const next = text.indexOf(fragment, cursor);
    expect(
      next,
      `Expected fragment ${JSON.stringify(fragment)} in ${text}`,
    ).toBeGreaterThanOrEqual(0);
    cursor = next + fragment.length;
  }
}

function assertHoverContent(
  content: string,
  expected: {
    includes?: string[];
    excludes?: string[];
  },
): void {
  if (expected.includes) {
    expectOrderedFragments(content, expected.includes);
  }

  for (const fragment of expected.excludes ?? []) {
    expect(content).not.toContain(fragment);
  }
}

function valuePosition(
  text: string,
  path: Array<string | number>,
): { lineNumber: number; column: number } {
  const range = resolveJsonPath(text, path);
  expect(range).not.toBeNull();
  if (!range) {
    return { lineNumber: 1, column: 1 };
  }

  return {
    lineNumber: range.startLineNumber,
    column: range.startColumn,
  };
}

function hoverRequiredState(
  descriptor: ReturnType<typeof describeSchema>,
  path: Array<string | number>,
  required: boolean,
): boolean | undefined {
  const lastSegment = path.at(-1);
  if (typeof lastSegment !== "string" || path.length === 0) {
    return undefined;
  }

  const parentContext = resolveFieldContext(descriptor, path.slice(0, -1));
  const parentNode = parentContext.schemaNode;
  if (!parentNode) return undefined;

  const hasProperty = (node: Record<string, unknown>, key: string): boolean => {
    const props = node.properties;
    if (props && typeof props === "object" && Object.prototype.hasOwnProperty.call(props, key)) {
      return true;
    }
    const allOf = node.allOf as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(allOf)) {
      return allOf.some((branch) => {
        const bp = branch.properties;
        return bp && typeof bp === "object" && Object.prototype.hasOwnProperty.call(bp, key);
      });
    }
    return false;
  };

  return hasProperty(parentNode, lastSegment)
    ? required
    : undefined;
}

function keyPosition(
  text: string,
  keyText: string,
): { lineNumber: number; column: number } {
  const offset = text.indexOf(keyText);
  expect(offset).toBeGreaterThanOrEqual(0);
  const index = new LineIndex(text);
  const { line, col } = index.offsetToPosition(offset + 1);
  return {
    lineNumber: line,
    column: col,
  };
}

describe("hover audit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("formatFieldMetadataHover", () => {
    for (const auditCase of hoverAuditCases) {
      test(`${auditCase.id} -> markdown matches manifest`, () => {
        const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
        const context = resolveFieldContext(descriptor, auditCase.hover.path);
        expect(context.metadata).toBeDefined();
        if (!context.metadata) return;

        const content = formatFieldMetadataHover(
          context.metadata,
          hoverRequiredState(
            descriptor,
            auditCase.hover.path,
            context.required,
          ),
          undefined,
          context.typeInfo,
        );

        assertHoverContent(content, auditCase.expectations.hoverMarkdown);
      });
    }

    test("enum case renders Turkish locale labels", () => {
      const auditCase = findHoverAuditCase("enum-status");
      expect(auditCase).not.toBeNull();
      if (!auditCase) return;

      const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
      const context = resolveFieldContext(descriptor, auditCase.hover.path);
      expect(context.metadata).toBeDefined();
      if (!context.metadata) return;

      const content = formatFieldMetadataHover(
        context.metadata,
        hoverRequiredState(descriptor, auditCase.hover.path, context.required),
        locales.tr,
        context.typeInfo,
      );

      assertHoverContent(content, {
        includes: [
          "**Status**",
          "**Zorunlu**",
          "**Örnekler:**",
          "**Enum değerleri:**",
        ],
      });
    });
  });

  describe("resolvePathAtOffset", () => {
    for (const auditCase of hoverAuditCases) {
      test(`${auditCase.id} -> value offset resolves to manifest path`, () => {
        const text = createHoverAuditText(auditCase);
        const position = valuePosition(text, auditCase.hover.path);
        const offset = positionToOffset(
          text,
          position.lineNumber,
          position.column,
        );
        const result = resolvePathAtOffset(text, offset);

        expect(result?.path).toEqual(toStringPath(auditCase.hover.path));
      });
    }

    test("key hover resolves to the same path as value hover", () => {
      const auditCase = findHoverAuditCase("uuid-required");
      expect(auditCase?.hover.keyText).toBeDefined();
      if (!auditCase?.hover.keyText) return;

      const text = createHoverAuditText(auditCase);
      const keyOffset = positionToOffset(
        text,
        keyPosition(text, auditCase.hover.keyText).lineNumber,
        keyPosition(text, auditCase.hover.keyText).column,
      );

      const result = resolvePathAtOffset(text, keyOffset);
      expect(result?.path).toEqual(toStringPath(auditCase.hover.path));
    });
  });

  describe("createZodHoverProvider", () => {
    for (const auditCase of hoverAuditCases) {
      test(`${auditCase.id} -> provider returns expected hover`, () => {
        const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
        const text = createHoverAuditText(auditCase);
        const model = createMockModel(text);
        const provider = createZodHoverProvider(
          descriptor,
          model.uri.toString(),
        );
        const result = provider.provideHover(
          model,
          valuePosition(text, auditCase.hover.path),
        );

        expect(result).not.toBeNull();
        expect(result?.contents).toHaveLength(1);
        assertHoverContent(
          result?.contents[0]?.value ?? "",
          auditCase.expectations.hoverMarkdown,
        );
      });
    }

    test("cache-backed and uncached providers stay in parity across the matrix", () => {
      for (const auditCase of hoverAuditCases) {
        const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
        const cache = new SchemaCache(
          descriptor.jsonSchema,
          descriptor.metadata,
        );
        const text = createHoverAuditText(auditCase);
        const model = createMockModel(text);
        const position = valuePosition(text, auditCase.hover.path);

        const uncached = createZodHoverProvider(
          descriptor,
          model.uri.toString(),
        ).provideHover(model, position);

        const cached = createZodHoverProvider(
          descriptor,
          model.uri.toString(),
          undefined,
          cache,
        ).provideHover(model, position);

        expect(cached).toEqual(uncached);
      }
    });

    test("provider supports key hover positions", () => {
      const auditCase = findHoverAuditCase("uuid-required");
      expect(auditCase?.hover.keyText).toBeDefined();
      if (!auditCase?.hover.keyText) return;

      const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
      const text = createHoverAuditText(auditCase);
      const model = createMockModel(text);
      const provider = createZodHoverProvider(descriptor, model.uri.toString());

      const result = provider.provideHover(
        model,
        keyPosition(text, auditCase.hover.keyText),
      );

      expect(result?.contents[0]?.value).toContain("Node ID");
    });

    test("provider returns null for URI mismatch", () => {
      const auditCase = findHoverAuditCase("uuid-required");
      expect(auditCase).not.toBeNull();
      if (!auditCase) return;

      const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
      const text = createHoverAuditText(auditCase);
      const provider = createZodHoverProvider(descriptor, "file:///other.json");
      const model = createMockModel(text, "file:///test.json");

      expect(
        provider.provideHover(model, valuePosition(text, auditCase.hover.path)),
      ).toBeNull();
    });

    test("provider returns null when metadata is absent", () => {
      const descriptor = describeSchema(
        z.object({
          raw: z.string(),
        }),
      );
      const text = JSON.stringify({ raw: "value" }, null, 2);
      const model = createMockModel(text);
      const provider = createZodHoverProvider(descriptor, model.uri.toString());

      expect(
        provider.provideHover(model, valuePosition(text, ["raw"])),
      ).toBeNull();
    });

    test("provider resolves nested email path inside a nullish object", () => {
      const auditCase = findHoverAuditCase("nullish-owner");
      expect(auditCase).not.toBeNull();
      if (!auditCase) return;

      const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
      const text = createHoverAuditText(auditCase);
      const model = createMockModel(text);
      const provider = createZodHoverProvider(descriptor, model.uri.toString());

      const result = provider.provideHover(
        model,
        valuePosition(text, ["owner", "email"]),
      );

      expect(result?.contents[0]?.value).toContain("Owner Email");
      expect(result?.contents[0]?.value).toContain("Owner email address");
    });
  });

  describe("attachZodToEditor", () => {
    test("hover feature toggle skips hover registration", () => {
      const auditCase = findHoverAuditCase("uuid-required");
      expect(auditCase).not.toBeNull();
      if (!auditCase) return;

      const descriptor = buildHoverAuditDescriptor(auditCase, describeSchema);
      const monaco = createMockMonaco();
      const editor = createMockEditor(createHoverAuditText(auditCase));

      const attachment = attachZodToEditor({
        monaco,
        editor,
        descriptor,
        features: {
          hover: false,
          validation: true,
          completions: true,
          diagnostics: true,
        },
      });

      expect(monaco.activeHoverProvider()).toBeNull();

      attachment.dispose();
    });

    test("setDescriptor refreshes the active hover provider", () => {
      const firstCase = findHoverAuditCase("uuid-required");
      const secondCase = findHoverAuditCase("enum-status");
      expect(firstCase).not.toBeNull();
      expect(secondCase).not.toBeNull();
      if (!firstCase || !secondCase) return;

      const monaco = createMockMonaco();
      const editor = createMockEditor(createHoverAuditText(firstCase));
      const attachment = attachZodToEditor({
        monaco,
        editor,
        descriptor: buildHoverAuditDescriptor(firstCase, describeSchema),
        validationDelay: 0,
      });

      const firstHover = monaco
        .activeHoverProvider()
        ?.provideHover(
          editor.model,
          valuePosition(editor.getValue(), firstCase.hover.path),
        );
      expect(firstHover?.contents[0]?.value).toContain("Node ID");

      editor.setValue(createHoverAuditText(secondCase));
      attachment.setDescriptor(
        buildHoverAuditDescriptor(secondCase, describeSchema),
      );

      const secondHover = monaco
        .activeHoverProvider()
        ?.provideHover(
          editor.model,
          valuePosition(editor.getValue(), secondCase.hover.path),
        );
      expect(secondHover?.contents[0]?.value).toContain("Status");
      expect(monaco.hoverRegistrations).toHaveLength(2);
      expect(monaco.hoverRegistrations[0]?.disposed).toBe(true);

      attachment.dispose();
    });

    test("dispose tears down hover registration, schema config, and markers", () => {
      const auditCase = findHoverAuditCase("uuid-required");
      expect(auditCase).not.toBeNull();
      if (!auditCase) return;

      const monaco = createMockMonaco();
      const editor = createMockEditor(createHoverAuditText(auditCase));
      const attachment = attachZodToEditor({
        monaco,
        editor,
        descriptor: buildHoverAuditDescriptor(auditCase, describeSchema),
        validationDelay: 0,
      });

      vi.runAllTimers();

      expect(monaco.diagnosticsHistory.at(-1)).toMatchObject({
        validate: true,
      });

      attachment.dispose();

      expect(monaco.hoverRegistrations[0]?.disposed).toBe(true);
      expect(monaco.diagnosticsHistory.at(-1)).toMatchObject({
        validate: false,
        schemas: [],
      });
      expect(monaco.markerCalls.at(-1)?.markers).toEqual([]);
    });
  });
});
