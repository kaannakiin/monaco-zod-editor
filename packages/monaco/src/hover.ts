import type { FieldMetadata, SchemaDescriptor } from "@zod-monaco/core";
import { resolveFieldMetadata, resolveJsonSchemaNode } from "@zod-monaco/core";
import type { MonacoModelLike, MonacoPosition } from "./monaco-types.js";
import { positionToOffset, resolvePathAtOffset } from "./json-path-position.js";

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
): string {
  const parts: string[] = [];

  if (meta.title) {
    parts.push(`**${meta.title}**`);
  }

  if (required !== undefined) {
    parts.push(required ? "**Required**" : "*Optional*");
  }

  if (meta.description) {
    parts.push(meta.description);
  }

  if (meta.examples && meta.examples.length > 0) {
    const formatted = meta.examples
      .map((ex) => `\`${JSON.stringify(ex)}\``)
      .join(", ");
    parts.push(`**Examples:** ${formatted}`);
  }

  if (meta.placeholder) {
    parts.push(`**Placeholder:** ${meta.placeholder}`);
  }

  if (meta.enumLabels) {
    const entries = Object.entries(meta.enumLabels)
      .map(([key, label]) => `${label} (\`${key}\`)`)
      .join(", ");
    parts.push(`**Enum values:** ${entries}`);
  }

  if (meta.emptyStateHint) {
    parts.push(`*${meta.emptyStateHint}*`);
  }

  return parts.join("\n\n");
}

export function createZodHoverProvider(
  descriptor: SchemaDescriptor,
  modelUri: string,
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
      const offset = positionToOffset(
        text,
        position.lineNumber,
        position.column,
      );
      const resolved = resolvePathAtOffset(text, offset);

      if (!resolved) {
        return null;
      }

      const meta = resolveFieldMetadata(
        descriptor.metadata,
        resolved.path,
        descriptor.jsonSchema,
      );

      if (!meta) {
        return null;
      }

      const fieldKey = resolved.path.at(-1);
      let required: boolean | undefined;
      if (typeof fieldKey === "string") {
        const parentPath = resolved.path.slice(0, -1);
        const parentNode = resolveJsonSchemaNode(
          descriptor.jsonSchema,
          parentPath,
        );
        const requiredArray = parentNode?.required;
        if (Array.isArray(requiredArray)) {
          required = requiredArray.includes(fieldKey);
        }
      }

      const content = formatFieldMetadataHover(meta, required);

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
