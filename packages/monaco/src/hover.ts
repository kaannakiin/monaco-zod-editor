import type {
  FieldMetadata,
  FieldPath,
  FieldTypeInfo,
  SchemaDescriptor,
} from "@zod-monaco/core";
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
  typeInfo?: FieldTypeInfo,
  readOnly?: boolean,
): string {
  const l = locale ?? defaultLocale;
  const parts: string[] = [];

  if (meta.title) {
    parts.push(`**${meta.title}**`);
  }

  if (readOnly) {
    parts.push(`**${l.readOnly}**`);
  }

  if (required !== undefined) {
    parts.push(required ? `**${l.required}**` : `*${l.optional}*`);
  }

  if (meta.description) {
    parts.push(meta.description);
  }

  if (typeInfo?.default !== undefined) {
    parts.push(`**${l.defaultValue}:** \`${JSON.stringify(typeInfo.default)}\``);
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
  const resolveRequiredState = (
    fieldPath: FieldPath,
    required: boolean,
  ): boolean | undefined => {
    const lastSegment = fieldPath.at(-1);
    if (typeof lastSegment !== "string" || fieldPath.length === 0) {
      return undefined;
    }

    const parentPath = fieldPath.slice(0, -1);
    const parentCtx = resolveFieldContext(descriptor, parentPath, cache);
    const parentNode = parentCtx.schemaNode;
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
  };

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

      const fieldPath: FieldPath = resolved.path;
      const fieldCtx = resolveFieldContext(descriptor, fieldPath, cache);

      if (!fieldCtx.metadata && !fieldCtx.readOnly) {
        return null;
      }

      const meta = fieldCtx.metadata ?? {};
      const required = resolveRequiredState(fieldPath, fieldCtx.required);

      const content = formatFieldMetadataHover(meta, required, locale, fieldCtx.typeInfo, fieldCtx.readOnly);

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
