import { describe, test, expect, vi, beforeEach } from "vitest";
import { prepareJsonEdit } from "../json-edit.js";
import { treeNodeDescriptor } from "@zod-monaco/core";
import type { MonacoStandaloneEditorLike, MonacoRange, MonacoModelLike } from "../monaco-types.js";

// ─── Mock editor helpers ─────────────────────────────────────────────────────

function makeModel(
  text: string,
  versionId = 1,
): MonacoModelLike & { _bump(): void } {
  let _versionId = versionId;
  return {
    uri: { scheme: "file", path: "/test.json", toString: () => "file:///test.json" },
    getValue: () => text,
    getPositionAt: () => ({ lineNumber: 1, column: 1 }),
    getVersionId: () => _versionId,
    getFullModelRange: (): MonacoRange => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: text.split("\n").length,
      endColumn: (text.split("\n").at(-1)?.length ?? 0) + 1,
    }),
    dispose: vi.fn(),
    _bump() {
      _versionId++;
    },
  };
}

function makeEditor(
  text: string,
  versionId = 1,
): MonacoStandaloneEditorLike & { model: ReturnType<typeof makeModel> } {
  const model = makeModel(text, versionId);
  const edits: Array<{ range: MonacoRange; text: string }> = [];

  return {
    model,
    getModel: () => model,
    getValue: () => text,
    setValue: vi.fn(),
    onDidChangeModelContent: vi.fn(),
    onDidChangeCursorPosition: vi.fn(),
    onDidBlurEditorWidget: vi.fn(),
    addCommand: vi.fn(),
    revealLineInCenter: vi.fn(),
    revealRangeInCenter: vi.fn(),
    setPosition: vi.fn(),
    setSelections: vi.fn(),
    updateOptions: vi.fn(),
    focus: vi.fn(),
    dispose: vi.fn(),
    executeEdits: vi.fn((_, e) => {
      edits.push(...e);
      return true;
    }),
  };
}

const descriptor = treeNodeDescriptor;

const validValue = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  label: "src",
  nodeType: "folder",
  metadata: {
    createdAt: "2026-01-01T00:00:00Z",
    permissions: ["read"],
    owner: null,
  },
  attributes: {},
  content: { kind: "text", body: "hello", encoding: "utf-8" },
  tags: ["root"],
  priority: 0,
  children: [],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("prepareJsonEdit", () => {
  describe("valid value", () => {
    test("valid is true for a schema-conforming value", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, validValue);
      expect(prepared.valid).toBe(true);
      expect(prepared.validationIssues).toHaveLength(0);
    });

    test("newText is JSON.stringify(newValue, null, 2)", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, validValue);
      expect(prepared.newText).toBe(JSON.stringify(validValue, null, 2));
    });

    test("diff is computed between old and new", () => {
      const oldValue = { ...validValue, label: "old" };
      const editor = makeEditor(JSON.stringify(oldValue));
      const prepared = prepareJsonEdit(editor, descriptor, validValue);
      const labelDiff = prepared.diff.find((d) => d.path.at(-1) === "label");
      expect(labelDiff).toBeDefined();
      expect(labelDiff!.action).toBe("changed");
      expect(labelDiff!.oldValue).toBe("old");
      expect(labelDiff!.newValue).toBe("src");
    });

    test("commit writes to editor via executeEdits", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, validValue);
      prepared.commit();
      expect(editor.executeEdits).toHaveBeenCalledOnce();
      const call = vi.mocked(editor.executeEdits).mock.calls[0];
      expect(call![0]).toBe("json-edit");
      expect(call![1][0]!.text).toBe(prepared.newText);
    });

    test("editor is NOT modified before commit", () => {
      const editor = makeEditor("{}");
      prepareJsonEdit(editor, descriptor, validValue);
      expect(editor.executeEdits).not.toHaveBeenCalled();
    });
  });

  describe("invalid value", () => {
    const invalidValue = { ...validValue, id: "not-a-uuid", label: "" };

    test("valid is false for schema-violating value", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, invalidValue);
      expect(prepared.valid).toBe(false);
    });

    test("validationIssues are populated with path and pointer", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, invalidValue);
      expect(prepared.validationIssues.length).toBeGreaterThan(0);
      for (const issue of prepared.validationIssues) {
        expect(Array.isArray(issue.path)).toBe(true);
        expect(typeof issue.pointer).toBe("string");
        expect(issue.pointer.startsWith("/") || issue.pointer === "").toBe(true);
        expect(typeof issue.message).toBe("string");
      }
    });

    test("commit() throws by default for invalid value", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, invalidValue);
      expect(() => prepared.commit()).toThrow();
      expect(editor.executeEdits).not.toHaveBeenCalled();
    });

    test("commit({ force: true }) writes even for invalid value", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, invalidValue);
      prepared.commit({ force: true });
      expect(editor.executeEdits).toHaveBeenCalledOnce();
    });
  });

  describe("stale detection", () => {
    test("stale is false immediately after prepare", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, validValue);
      expect(prepared.stale).toBe(false);
    });

    test("stale becomes true when model version changes", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, validValue);
      // Simulate editor content change
      editor.model._bump();
      expect(prepared.stale).toBe(true);
    });

    test("commit() throws when stale", () => {
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, validValue);
      editor.model._bump();
      expect(() => prepared.commit()).toThrow(/stale|changed/i);
      expect(editor.executeEdits).not.toHaveBeenCalled();
    });
  });

  describe("diff with empty old content", () => {
    test("unparseable old content treated as undefined — full add diff", () => {
      const editor = makeEditor("INVALID JSON");
      const prepared = prepareJsonEdit(editor, descriptor, { key: "val" });
      // Can't parse old → treated as undefined → changed at root
      expect(prepared.diff.length).toBeGreaterThan(0);
    });
  });

  describe("ValidationIssue pointer format", () => {
    test("nested issue has correct RFC 6901 pointer", () => {
      const badValue = {
        ...validValue,
        metadata: { ...validValue.metadata, createdAt: "not-a-date" },
      };
      const editor = makeEditor("{}");
      const prepared = prepareJsonEdit(editor, descriptor, badValue);
      const issue = prepared.validationIssues.find(
        (i) => i.path.includes("createdAt"),
      );
      if (issue) {
        expect(issue.pointer).toContain("/metadata/");
        expect(issue.pointer).toContain("createdAt");
      }
    });
  });
});
