import type { FieldMetadata, FieldPath, SchemaDescriptor } from "@zod-monaco/core";
import { resolveFieldContext, SchemaCache } from "@zod-monaco/core";
import type { MonacoModelLike, MonacoPosition } from "./monaco-types.js";
import { positionToOffset, resolvePathAtOffset } from "./json-path-position.js";
import type { LineIndex } from "./json-path-position.js";
import type { ZodMonacoLocale } from "./locale.js";
import { defaultLocale } from "./locale.js";

export interface ZodHoverResult {
  contents: Array<{ value: string }>;
  range?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface ZodHoverProvider {
  provideHover(
    model: MonacoModelLike,
    position: MonacoPosition,
  ): ZodHoverResult | null;
}

export function formatFieldMetadataHover(
  meta: FieldMetadata,
  required?: boolean,
  locale?: ZodMonacoLocale,
): string {
  const l = locale ?? defaultLocale;
  const parts: string[] = [];

  if (meta.title) {
    parts.push(`**${meta.title}**`);
  }

  if (required !== undefined) {
    parts.push(required ? `**${l.required}**` : `*${l.optional}*`);
  }

  if (meta.description) {
    parts.push(meta.description);
  }

  if (meta.examples && meta.examples.length > 0) {
    const formatted = meta.examples
      .map((ex) => `\`${JSON.stringify(ex)}\``)
      .join(", ");
    parts.push(`**${l.examples}:** ${formatted}`);
  }

  if (meta.placeholder) {
    parts.push(`**${l.placeholder}:** ${meta.placeholder}`);
  }

  if (meta.enumLabels) {
    const entries = Object.entries(meta.enumLabels)
      .map(([key, label]) => `${label} (\`${key}\`)`)
      .join(", ");
    parts.push(`**${l.enumValues}:** ${entries}`);
  }

  if (meta.emptyStateHint) {
    parts.push(`*${meta.emptyStateHint}*`);
  }

  return parts.join("\n\n");
}

export function createZodHoverProvider(
  descriptor: SchemaDescriptor,
  modelUri: string,
  locale?: ZodMonacoLocale,
  cache?: SchemaCache,
  getLineIndex?: () => LineIndex | null,
): ZodHoverProvider {
  return {
    provideHover(
      model: MonacoModelLike,
      position: MonacoPosition,
    ): ZodHoverResult | null {
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
      const resolved = resolvePathAtOffset(text, offset);

      if (!resolved) {
        return null;
      }

      // Convert string[] path → FieldPath (coerce numeric-looking segments to number)
      const fieldPath: FieldPath = resolved.path.map((s) =>
        /^\d+$/.test(s) ? Number(s) : s,
      );
      const fieldCtx = resolveFieldContext(descriptor, fieldPath, cache);

      if (!fieldCtx.metadata) {
        return null;
      }

      const meta = fieldCtx.metadata;
      const required = fieldCtx.required || undefined;

      const content = formatFieldMetadataHover(meta, required, locale);

      if (!content) {
        return null;
      }

      return {
        contents: [{ value: content }],
        range: resolved.keyRange,
      };
    },
  };
}
