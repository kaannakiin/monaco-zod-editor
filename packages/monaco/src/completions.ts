import type { SchemaDescriptor } from "@zod-monaco/core";
import { resolveFieldMetadata, resolveJsonSchemaNode } from "@zod-monaco/core";
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

export interface ZodCompletionProvider {
  provideCompletionItems(
    model: MonacoModelLike,
    position: MonacoPosition,
    context: MonacoCompletionContext,
  ): MonacoCompletionList | null;
}

// Monaco CompletionItemKind.EnumMember = 17
const ENUM_MEMBER_KIND = 17;

export function createZodCompletionProvider(
  descriptor: SchemaDescriptor,
  modelUri: string,
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
      const offset = positionToOffset(
        text,
        position.lineNumber,
        position.column,
      );
      const ctx = getValueContext(text, offset);

      if (!ctx) {
        return null;
      }

      const schemaNode = resolveJsonSchemaNode(descriptor.jsonSchema, ctx.path);

      if (!schemaNode) {
        return null;
      }

      const enumValues = schemaNode.enum as unknown[] | undefined;
      if (!Array.isArray(enumValues)) {
        return null;
      }

      const meta = resolveFieldMetadata(
        descriptor.metadata,
        ctx.path,
        descriptor.jsonSchema,
      );
      const labels = meta?.enumLabels;

      const suggestions: MonacoCompletionItem[] = enumValues.map((val, i) => {
        if (ctx.insideString && typeof val === "string") {
          // Cursor is inside quotes — insert raw value and replace inner content
          const range = makePosition(text, ctx.innerStart, ctx.innerEnd);
          return {
            label: String(val),
            kind: ENUM_MEMBER_KIND,
            detail: labels?.[String(val)],
            insertText: val,
            sortText: String(i).padStart(4, "0"),
            range,
          };
        }

        // Cursor is not inside a string — replace the entire value token
        const range = makePosition(text, ctx.valueStart, ctx.valueEnd);
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
