import type { SchemaDescriptor } from "@zod-monaco/core";
import {
  resolveFieldMetadata,
  resolveJsonSchemaNode,
  SchemaCache,
} from "@zod-monaco/core";
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

      const schemaNode = cache
        ? cache.resolveNode(ctx.path)
        : resolveJsonSchemaNode(descriptor.jsonSchema, ctx.path);

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
        cache,
      );
      const labels = meta?.enumLabels;

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
