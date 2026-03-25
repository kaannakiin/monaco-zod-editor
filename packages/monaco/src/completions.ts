import type { FieldPath, SchemaDescriptor } from "@zod-monaco/core";
import { resolveFieldContext, SchemaCache } from "@zod-monaco/core";
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
  provideCompletionItems(
    model: MonacoModelLike,
    position: MonacoPosition,
    context: MonacoCompletionContext,
  ): MonacoCompletionList | null;
}

const ENUM_MEMBER_KIND = 17;

export function createZodCompletionProvider(
  descriptor: SchemaDescriptor,
  modelUri: string,
  cache?: SchemaCache,
  getLineIndex?: () => LineIndex | null,
): ZodCompletionProvider {
  return {
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

      const enumValues = fieldCtx.typeInfo.enum;
      if (!Array.isArray(enumValues)) {
        return null;
      }

      const labels = fieldCtx.metadata?.enumLabels;

      const suggestions: MonacoCompletionItem[] = enumValues.map((val, i) => {
        if (ctx.insideString && typeof val === "string") {
          const range = makePosition(text, ctx.innerStart, ctx.innerEnd, idx);
          return {
            label: String(val),
            kind: ENUM_MEMBER_KIND,
            detail: labels?.[String(val)],
            insertText: val,
            sortText: String(i).padStart(4, "0"),
            range,
          };
        }

        const range = makePosition(text, ctx.valueStart, ctx.valueEnd, idx);
        return {
          label: String(val),
          kind: ENUM_MEMBER_KIND,
          detail: labels?.[String(val)],
          insertText: JSON.stringify(val),
          sortText: String(i).padStart(4, "0"),
          range,
        };
      });

      return { suggestions };
    },
  };
}
