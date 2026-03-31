import type { FieldPath, SchemaDescriptor, SuggestionRefinement } from "@zod-monaco/core";
import { resolveFieldContext, SchemaCache, matchesSchemaPath } from "@zod-monaco/core";
import type {
  MonacoModelLike,
  MonacoPosition,
  MonacoCompletionContext,
  MonacoCompletionList,
  MonacoCompletionItem,
} from "./monaco-types.js";
import {
  positionToOffset,
  getValueContext,
  makePosition,
} from "./json-path-position.js";
import type { LineIndex } from "./json-path-position.js";

export interface ZodCompletionProvider {
  triggerCharacters?: string[];
  provideCompletionItems(
    model: MonacoModelLike,
    position: MonacoPosition,
    context: MonacoCompletionContext,
  ): MonacoCompletionList | null;
}

const ENUM_MEMBER_KIND = 17;
const TEXT_KIND = 1;

/**
 * Extracts single literal characters from simple triggerPattern strings.
 * Only patterns that are a single literal char (possibly backslash-escaped)
 * produce a triggerCharacter. Complex regex patterns are ignored.
 */
function deriveTriggerCharacters(
  refinements?: readonly SuggestionRefinement[],
): string[] | undefined {
  if (!refinements?.length) return undefined;
  const chars = new Set<string>();
  for (const ref of refinements) {
    if (!ref.triggerPattern) continue;
    const match = ref.triggerPattern.match(/^\\(.)$/);
    if (match) {
      chars.add(match[1]!);
    } else if (ref.triggerPattern.length === 1) {
      chars.add(ref.triggerPattern);
    }
  }
  return chars.size > 0 ? [...chars] : undefined;
}

export function createZodCompletionProvider(
  descriptor: SchemaDescriptor,
  modelUri: string,
  cache?: SchemaCache,
  getLineIndex?: () => LineIndex | null,
  refinements?: readonly SuggestionRefinement[],
): ZodCompletionProvider {
  const triggerCharacters = deriveTriggerCharacters(refinements);

  return {
    triggerCharacters,
    provideCompletionItems(
      model: MonacoModelLike,
      position: MonacoPosition,
    ): MonacoCompletionList | null {
      if (model.uri.toString() !== modelUri) {
        return null;
      }

      const text = model.getValue();
      const idx = getLineIndex?.() ?? undefined;
      const offset = positionToOffset(
        text,
        position.lineNumber,
        position.column,
        idx,
      );
      const ctx = getValueContext(text, offset);

      if (!ctx) {
        return null;
      }

      // Convert string[] path → FieldPath (coerce numeric-looking segments to number)
      const fieldPath: FieldPath = ctx.path.map((s) =>
        /^\d+$/.test(s) ? Number(s) : s,
      );
      const fieldCtx = resolveFieldContext(descriptor, fieldPath, cache);

      const items: MonacoCompletionItem[] = [];

      // 1. Enum completions (priority — from JSON Schema)
      const enumValues = fieldCtx.typeInfo.enum;
      if (Array.isArray(enumValues)) {
        const labels = fieldCtx.metadata?.enumLabels;
        for (let i = 0; i < enumValues.length; i++) {
          const val = enumValues[i];
          if (ctx.insideString && typeof val === "string") {
            items.push({
              label: String(val),
              kind: ENUM_MEMBER_KIND,
              detail: labels?.[String(val)],
              insertText: val,
              sortText: String(i).padStart(4, "0"),
              range: makePosition(text, ctx.innerStart, ctx.innerEnd, idx),
            });
          } else {
            items.push({
              label: String(val),
              kind: ENUM_MEMBER_KIND,
              detail: labels?.[String(val)],
              insertText: JSON.stringify(val),
              sortText: String(i).padStart(4, "0"),
              range: makePosition(text, ctx.valueStart, ctx.valueEnd, idx),
            });
          }
        }
      }

      // 2. Suggestion refinements (soft — only when no enum items)
      if (items.length === 0 && refinements?.length) {
        for (const ref of refinements) {
          if (!matchesSchemaPath(fieldPath, ref.path as readonly string[])) continue;

          // triggerPattern gating: check text content before cursor
          if (ref.triggerPattern && ctx.insideString) {
            const textBeforeCursor = text.slice(ctx.innerStart, offset);
            if (!new RegExp(ref.triggerPattern).test(textBeforeCursor)) continue;
          }

          const range = ctx.insideString
            ? makePosition(text, ctx.innerStart, ctx.innerEnd, idx)
            : makePosition(text, ctx.valueStart, ctx.valueEnd, idx);

          for (let i = 0; i < ref.suggestions.length; i++) {
            const suggestion = ref.suggestions[i]!;
            items.push({
              label: suggestion,
              kind: TEXT_KIND,
              insertText: ctx.insideString ? suggestion : JSON.stringify(suggestion),
              sortText: `z${String(i).padStart(4, "0")}`,
              range,
            });
          }
        }
      }

      return items.length > 0 ? { suggestions: items } : null;
    },
  };
}
