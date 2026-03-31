import { describe, test, expect } from "vitest";
import { z } from "../../../core/node_modules/zod/index.js";
import { describeSchema } from "@zod-monaco/core";
import type { SuggestionRefinement } from "@zod-monaco/core";
import { createZodCompletionProvider } from "../completions.js";
import { attachZodToEditor } from "../attach.js";
import {
  createMockEditor,
  createMockMonaco,
} from "../../test-support/mock-monaco.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MODEL_URI = "file:///test.json";

/** Build a descriptor and a mock editor pre-loaded with the given JSON value. */
function setup(schema: z.ZodType, json: string) {
  const descriptor = describeSchema(schema);
  const editor = createMockEditor(json, MODEL_URI);
  const model = editor.getModel()!;
  return { descriptor, editor, model };
}

/** Ask the provider for completions at the given 1-based line/column. */
function complete(
  provider: ReturnType<typeof createZodCompletionProvider>,
  model: ReturnType<typeof createMockEditor>["model"],
  lineNumber: number,
  column: number,
) {
  return provider.provideCompletionItems(
    model,
    { lineNumber, column },
    { triggerKind: 1 },
  );
}

// ─── Suggestion completion items ─────────────────────────────────────────────

describe("createZodCompletionProvider — suggestion refinements", () => {
  test("returns TEXT suggestion items for matching path", () => {
    const schema = z.object({ content: z.string() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      { path: ["content"], suggestions: ["{Name}", "{Price}"] },
    ];

    // JSON: { "content": "" } — cursor inside the string value (col 14)
    const json = '{ "content": "" }';
    const model = createMockEditor(json, MODEL_URI).getModel()!;
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );

    // col 14 is inside the string value ""
    const result = complete(provider, model, 1, 14);
    expect(result).not.toBeNull();
    expect(result!.suggestions.length).toBe(2);
    expect(result!.suggestions[0]!.label).toBe("{Name}");
    expect(result!.suggestions[1]!.label).toBe("{Price}");
    // Soft suggestions use TEXT kind (1)
    expect(result!.suggestions[0]!.kind).toBe(1);
  });

  test("manual completion works without triggerPattern", () => {
    const schema = z.object({ note: z.string() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      { path: ["note"], suggestions: ["hello", "world"] },
    ];

    const json = '{ "note": "a" }';
    const model = createMockEditor(json, MODEL_URI).getModel()!;
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );

    // Cursor inside "a" — no trigger pattern, should still get suggestions
    const result = complete(provider, model, 1, 12);
    expect(result).not.toBeNull();
    expect(result!.suggestions.map((s) => s.label)).toContain("hello");
  });

  test("{ trigger produces suggestions when pattern matches", () => {
    const schema = z.object({ template: z.string() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      {
        path: ["template"],
        suggestions: ["{Name}", "{Price}"],
        triggerPattern: "\\{",
      },
    ];

    // '{ "template": "{" }'
    //  0123456789012345678
    // cursor after "{" = col 17 (Monaco 1-indexed: offset 16)
    const json = '{ "template": "{" }';
    const model = createMockEditor(json, MODEL_URI).getModel()!;
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );

    const result = complete(provider, model, 1, 17);
    expect(result).not.toBeNull();
    expect(result!.suggestions.length).toBe(2);
  });

  test("triggerPattern blocks suggestions when text before cursor does not match", () => {
    const schema = z.object({ template: z.string() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      {
        path: ["template"],
        suggestions: ["{Name}"],
        triggerPattern: "\\{",
      },
    ];

    // Cursor inside "abc" — no "{" before cursor
    const json = '{ "template": "abc" }';
    const model = createMockEditor(json, MODEL_URI).getModel()!;
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );

    // col 16 is inside "abc"
    const result = complete(provider, model, 1, 16);
    expect(result).toBeNull();
  });

  test("enum completions take priority over suggestions on same path", () => {
    const schema = z.object({ status: z.enum(["active", "inactive"]) });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      { path: ["status"], suggestions: ["{Draft}"] },
    ];

    const json = '{ "status": "" }';
    const model = createMockEditor(json, MODEL_URI).getModel()!;
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );

    const result = complete(provider, model, 1, 14);
    expect(result).not.toBeNull();
    // Only enum items (kind 17), no TEXT suggestions
    expect(result!.suggestions.every((s) => s.kind === 17)).toBe(true);
    expect(result!.suggestions.map((s) => s.label)).toContain("active");
    expect(result!.suggestions.map((s) => s.label)).not.toContain("{Draft}");
  });

  test("returns null when no enum and no matching refinement", () => {
    const schema = z.object({ count: z.number() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      { path: ["other"], suggestions: ["{X}"] },
    ];

    const json = '{ "count": 1 }';
    const model = createMockEditor(json, MODEL_URI).getModel()!;
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );

    const result = complete(provider, model, 1, 12);
    expect(result).toBeNull();
  });
});

// ─── triggerCharacters derivation ────────────────────────────────────────────

describe("triggerCharacters derivation", () => {
  test("single escaped char produces triggerCharacter", () => {
    const schema = z.object({ x: z.string() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      { path: ["x"], suggestions: ["{A}"], triggerPattern: "\\{" },
    ];
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );
    expect(provider.triggerCharacters).toEqual(["{"]);
  });

  test("single literal char produces triggerCharacter", () => {
    const schema = z.object({ x: z.string() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      { path: ["x"], suggestions: ["@user"], triggerPattern: "@" },
    ];
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );
    expect(provider.triggerCharacters).toEqual(["@"]);
  });

  test("complex triggerPattern does not produce triggerCharacters", () => {
    const schema = z.object({ x: z.string() });
    const descriptor = describeSchema(schema);
    const refinements: readonly SuggestionRefinement[] = [
      { path: ["x"], suggestions: ["ABC"], triggerPattern: "[A-Z]" },
    ];
    const provider = createZodCompletionProvider(
      descriptor,
      MODEL_URI,
      undefined,
      undefined,
      refinements,
    );
    expect(provider.triggerCharacters).toBeUndefined();
  });

  test("no refinements produces no triggerCharacters", () => {
    const schema = z.object({ x: z.string() });
    const descriptor = describeSchema(schema);
    const provider = createZodCompletionProvider(descriptor, MODEL_URI);
    expect(provider.triggerCharacters).toBeUndefined();
  });
});

// ─── attachZodToEditor integration ───────────────────────────────────────────

describe("attachZodToEditor — suggestion refinements", () => {
  test("completion registration carries triggerCharacters", () => {
    const mockMonaco = createMockMonaco();
    const editor = createMockEditor('{ "x": "" }', MODEL_URI);
    const descriptor = describeSchema(z.object({ x: z.string() }));

    const attachment = attachZodToEditor({
      monaco: mockMonaco,
      editor,
      descriptor,
      refinements: [
        { path: ["x"], suggestions: ["{A}"], triggerPattern: "\\{" },
      ],
    });

    expect(mockMonaco.completionRegistrations.length).toBe(1);
    expect(mockMonaco.completionRegistrations[0]!.triggerCharacters).toEqual([
      "{",
    ]);

    attachment.dispose();
  });

  test("setRefinements() re-registers provider and disposes old one", () => {
    const mockMonaco = createMockMonaco();
    const editor = createMockEditor('{ "x": "" }', MODEL_URI);
    const descriptor = describeSchema(z.object({ x: z.string() }));

    const attachment = attachZodToEditor({
      monaco: mockMonaco,
      editor,
      descriptor,
    });

    expect(mockMonaco.completionRegistrations.length).toBe(1);

    attachment.setRefinements([
      { path: ["x"], suggestions: ["{Name}", "{Price}"] },
    ]);

    // Old registration should be disposed, new one created
    expect(mockMonaco.completionRegistrations.length).toBe(2);
    expect(mockMonaco.completionRegistrations[0]!.disposed).toBe(true);
    expect(mockMonaco.completionRegistrations[1]!.disposed).toBe(false);

    // New provider should return updated suggestions
    const provider = mockMonaco.activeCompletionProvider()!;
    const model = editor.getModel()!;
    const result = provider.provideCompletionItems(
      model,
      { lineNumber: 1, column: 9 },
      { triggerKind: 1 },
    );
    expect(result?.suggestions.map((s) => s.label)).toContain("{Name}");

    attachment.dispose();
  });

  test("dispose tears down all completion registrations", () => {
    const mockMonaco = createMockMonaco();
    const editor = createMockEditor('{ "x": "" }', MODEL_URI);
    const descriptor = describeSchema(z.object({ x: z.string() }));

    const attachment = attachZodToEditor({
      monaco: mockMonaco,
      editor,
      descriptor,
      refinements: [{ path: ["x"], suggestions: ["{A}"] }],
    });

    attachment.setRefinements([{ path: ["x"], suggestions: ["{B}"] }]);
    attachment.dispose();

    expect(
      mockMonaco.completionRegistrations.every((r) => r.disposed),
    ).toBe(true);
  });
});
