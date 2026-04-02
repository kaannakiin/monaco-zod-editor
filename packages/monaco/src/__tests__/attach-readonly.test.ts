import { describe, test, expect, vi } from "vitest";
import { z } from "../../../core/node_modules/zod/index.js";
import { describeSchema } from "@zod-monaco/core";
import type { SchemaDescriptor, FieldPath } from "@zod-monaco/core";
import { attachZodToEditor } from "../attach.js";
import { createMockEditor, createMockMonaco } from "../../test-support/mock-monaco.js";



const MODEL_URI = "file:///test.json";

function makeDescriptorWithReadOnlyPaths(
  schema: z.ZodType,
  readOnlyPaths: string[],
): SchemaDescriptor {
  const base = describeSchema(schema);
  return {
    ...base,
    metadata: {
      ...base.metadata,
      readOnlyPaths: new Set(readOnlyPaths),
    },
  };
}

function makeRootReadOnlyDescriptor(schema: z.ZodType): SchemaDescriptor {
  const base = describeSchema(schema);
  return {
    ...base,
    metadata: {
      ...base.metadata,
      readOnly: true,
    },
  };
}



describe("guardReadOnlyEdit — revertToText fallback", () => {
  test("uses executeEdits fallback when trigger is absent", () => {
    const schema = z.object({ name: z.string(), status: z.string() });
    const descriptor = makeDescriptorWithReadOnlyPaths(schema, ["/status"]);
    const monaco = createMockMonaco();
    const initialJson = JSON.stringify({ name: "Alice", status: "active" });
    const editor = createMockEditor(initialJson, MODEL_URI);

    
    expect(typeof (editor as unknown as Record<string, unknown>).trigger).toBe("undefined");

    const executeEditsSpy = vi.spyOn(editor, "executeEdits");

    attachZodToEditor({ monaco, editor, descriptor });

    
    
    const statusOffset = initialJson.indexOf('"active"') + 1;
    editor.emitChange({
      changes: [{ rangeOffset: statusOffset, rangeLength: 6, text: "locked", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);

    
    expect(executeEditsSpy).toHaveBeenCalledWith(
      "readOnly-revert",
      expect.arrayContaining([
        expect.objectContaining({ text: initialJson }),
      ]),
    );
  });

  test("uses trigger when available", () => {
    const schema = z.object({ name: z.string(), status: z.string() });
    const descriptor = makeDescriptorWithReadOnlyPaths(schema, ["/status"]);
    const monaco = createMockMonaco();
    const initialJson = JSON.stringify({ name: "Alice", status: "active" });
    const editor = createMockEditor(initialJson, MODEL_URI);

    const triggerMock = vi.fn();
    (editor as unknown as Record<string, unknown>).trigger = triggerMock;

    attachZodToEditor({ monaco, editor, descriptor });

    const statusOffset = initialJson.indexOf('"active"') + 1;
    editor.emitChange({
      changes: [{ rangeOffset: statusOffset, rangeLength: 6, text: "locked", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);

    expect(triggerMock).toHaveBeenCalledWith("readOnlyGuard", "undo", null);
  });
});

describe("guardReadOnlyEdit — onReadOnlyViolation callback", () => {
  test("fires callback when a locked field is edited", () => {
    const schema = z.object({ name: z.string(), status: z.string() });
    const descriptor = makeDescriptorWithReadOnlyPaths(schema, ["/status"]);
    const monaco = createMockMonaco();
    const initialJson = JSON.stringify({ name: "Alice", status: "active" });
    const editor = createMockEditor(initialJson, MODEL_URI);

    const onReadOnlyViolation = vi.fn();
    attachZodToEditor({ monaco, editor, descriptor, onReadOnlyViolation });

    const statusOffset = initialJson.indexOf('"active"') + 1;
    editor.emitChange({
      changes: [{ rangeOffset: statusOffset, rangeLength: 6, text: "locked", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);

    expect(onReadOnlyViolation).toHaveBeenCalledOnce();
    const detail = onReadOnlyViolation.mock.calls[0]![0] as { path: FieldPath; operation: string };
    expect(detail.path).toContain("status");
    expect(detail.operation).toBe("type");
  });

  test("fires callback with empty path for root-level readOnly", () => {
    const schema = z.object({ name: z.string() });
    const descriptor = makeRootReadOnlyDescriptor(schema);
    const monaco = createMockMonaco();
    const initialJson = JSON.stringify({ name: "Alice" });
    const editor = createMockEditor(initialJson, MODEL_URI);

    const onReadOnlyViolation = vi.fn();
    attachZodToEditor({ monaco, editor, descriptor, onReadOnlyViolation });

    editor.emitChange({
      changes: [{ rangeOffset: 2, rangeLength: 4, text: "Bob", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);

    expect(onReadOnlyViolation).toHaveBeenCalledOnce();
    const detail = onReadOnlyViolation.mock.calls[0]![0] as { path: FieldPath; operation: string };
    expect(Array.isArray(detail.path)).toBe(true);
    expect(detail.path).toHaveLength(0);
    expect(detail.operation).toBe("type");
  });
});

describe("guardReadOnlyEdit — ancestor-replace blocked", () => {
  test("blocks edit when ancestor path covers a locked descendant", () => {
    const schema = z.object({
      metadata: z.object({ createdAt: z.string() }),
    });
    const descriptor = makeDescriptorWithReadOnlyPaths(schema, ["/metadata/createdAt"]);
    const monaco = createMockMonaco();
    
    
    const initialJson = JSON.stringify({ metadata: { createdAt: "2024" } });
    const editor = createMockEditor(initialJson, MODEL_URI);

    const onReadOnlyViolation = vi.fn();
    const executeEditsSpy = vi.spyOn(editor, "executeEdits");
    attachZodToEditor({ monaco, editor, descriptor, onReadOnlyViolation });

    
    const metadataOffset = initialJson.indexOf('{"createdAt"') + 1;
    editor.emitChange({
      changes: [{ rangeOffset: metadataOffset, rangeLength: 10, text: "overwritten", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);

    expect(onReadOnlyViolation).toHaveBeenCalledOnce();
    expect(executeEditsSpy).toHaveBeenCalledWith("readOnly-revert", expect.anything());
  });
});

describe("guardReadOnlyEdit — multi-line selection bypass", () => {
  test("blocks edit when multi-line range includes locked descendant even if rangeOffset is unlocked", () => {
    const schema = z.object({
      label: z.string(),
      nodeType: z.string(),
      metadata: z.object({ createdAt: z.string() }),
    });
    const descriptor = makeDescriptorWithReadOnlyPaths(schema, ["/metadata/createdAt"]);
    const monaco = createMockMonaco();
    const initialJson = JSON.stringify(
      { label: "src", nodeType: "folder", metadata: { createdAt: "2026-03-13T10:30:00Z" } },
      null,
      2,
    );
    const editor = createMockEditor(initialJson, MODEL_URI);

    const onReadOnlyViolation = vi.fn();
    const executeEditsSpy = vi.spyOn(editor, "executeEdits");
    attachZodToEditor({ monaco, editor, descriptor, onReadOnlyViolation });

    
    const rangeStart = initialJson.indexOf('"label"');
    const createdAtValueEnd =
      initialJson.indexOf('"2026-03-13T10:30:00Z"') + '"2026-03-13T10:30:00Z"'.length;

    editor.emitChange({
      changes: [{
        rangeOffset: rangeStart,
        rangeLength: createdAtValueEnd - rangeStart,
        range: { startLineNumber: 1, startColumn: 1, endLineNumber: 5, endColumn: 1 },
        text: "",
      }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);

    expect(onReadOnlyViolation).toHaveBeenCalledOnce();
    expect(executeEditsSpy).toHaveBeenCalledWith("readOnly-revert", expect.anything());
  });
});

describe("guardReadOnlyEdit — operation detection", () => {
  function setupForOperation() {
    const schema = z.object({ name: z.string(), status: z.string() });
    const descriptor = makeDescriptorWithReadOnlyPaths(schema, ["/status"]);
    const monaco = createMockMonaco();
    const initialJson = JSON.stringify({ name: "Alice", status: "active" });
    const editor = createMockEditor(initialJson, MODEL_URI);
    const onReadOnlyViolation = vi.fn();
    attachZodToEditor({ monaco, editor, descriptor, onReadOnlyViolation });
    const statusOffset = initialJson.indexOf('"active"') + 1;
    return { editor, onReadOnlyViolation, statusOffset };
  }

  test("detects type operation for small replacement", () => {
    const { editor, onReadOnlyViolation, statusOffset } = setupForOperation();
    editor.emitChange({
      changes: [{ rangeOffset: statusOffset, rangeLength: 1, text: "x", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);
    const detail = onReadOnlyViolation.mock.calls[0]![0] as { operation: string };
    expect(detail.operation).toBe("type");
  });

  test("detects delete operation for empty text", () => {
    const { editor, onReadOnlyViolation, statusOffset } = setupForOperation();
    editor.emitChange({
      changes: [{ rangeOffset: statusOffset, rangeLength: 6, text: "", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);
    const detail = onReadOnlyViolation.mock.calls[0]![0] as { operation: string };
    expect(detail.operation).toBe("delete");
  });

  test("detects paste operation for multi-line text", () => {
    const { editor, onReadOnlyViolation, statusOffset } = setupForOperation();
    editor.emitChange({
      changes: [{ rangeOffset: statusOffset, rangeLength: 6, text: "pasted\nvalue", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } }],
    } as unknown as Parameters<typeof editor.emitChange>[0]);
    const detail = onReadOnlyViolation.mock.calls[0]![0] as { operation: string };
    expect(detail.operation).toBe("paste");
  });

  test("detects replace operation for batch changes", () => {
    const { editor, onReadOnlyViolation, statusOffset } = setupForOperation();
    editor.emitChange({
      changes: [
        { rangeOffset: statusOffset, rangeLength: 1, text: "x", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } },
        { rangeOffset: statusOffset + 2, rangeLength: 1, text: "y", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 } },
      ],
    } as unknown as Parameters<typeof editor.emitChange>[0]);
    const detail = onReadOnlyViolation.mock.calls[0]![0] as { operation: string };
    expect(detail.operation).toBe("replace");
  });
});
