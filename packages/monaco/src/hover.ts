import type {
  FieldMetadata,
  FieldPath,
  FieldTypeInfo,
  SchemaDescriptor,
} from "@zod-monaco/core";
import { resolveFieldContext, SchemaCache } from "@zod-monaco/core";
import type { MonacoModelLike, MonacoPosition, MonacoMatchingSchema } from "./monaco-types.js";
import { positionToOffset, resolvePathAtOffset } from "./json-path-position.js";
import type { LineIndex } from "./json-path-position.js";
import type { ZodMonacoLocale } from "./locale.js";
import { defaultLocale } from "./locale.js";
import type { WorkerBridge } from "./worker-bridge.js";

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
  ): ZodHoverResult | null | PromiseLike<ZodHoverResult | null>;
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

  if (meta.constraints) {
    const c = meta.constraints;
    const constraintParts: string[] = [];
    if (c.minimum !== undefined || c.maximum !== undefined) {
      const min = c.minimum ?? c.exclusiveMinimum;
      const max = c.maximum ?? c.exclusiveMaximum;
      if (min !== undefined && max !== undefined) constraintParts.push(`${min}–${max}`);
      else if (min !== undefined) constraintParts.push(`≥ ${min}`);
      else if (max !== undefined) constraintParts.push(`≤ ${max}`);
    }
    if (c.minLength !== undefined || c.maxLength !== undefined) {
      if (c.minLength !== undefined && c.maxLength !== undefined) constraintParts.push(`${c.minLength}–${c.maxLength} chars`);
      else if (c.minLength !== undefined) constraintParts.push(`min ${c.minLength} chars`);
      else if (c.maxLength !== undefined) constraintParts.push(`max ${c.maxLength} chars`);
    }
    if (c.pattern) constraintParts.push(`pattern: \`${c.pattern}\``);
    if (c.multipleOf !== undefined) constraintParts.push(`multiple of ${c.multipleOf}`);
    if (c.minItems !== undefined || c.maxItems !== undefined) {
      if (c.minItems !== undefined && c.maxItems !== undefined) constraintParts.push(`${c.minItems}–${c.maxItems} items`);
      else if (c.minItems !== undefined) constraintParts.push(`min ${c.minItems} items`);
      else if (c.maxItems !== undefined) constraintParts.push(`max ${c.maxItems} items`);
    }
    if (c.uniqueItems) constraintParts.push("unique items");
    if (constraintParts.length > 0) {
      parts.push(`**${l.constraints ?? "Constraints"}:** ${constraintParts.join(", ")}`);
    }
  }

  return parts.join("\n\n");
}

export function createZodHoverProvider(
  descriptor: SchemaDescriptor,
  modelUri: string,
  locale?: ZodMonacoLocale,
  cache?: SchemaCache,
  getLineIndex?: () => LineIndex | null,
  workerBridge?: WorkerBridge,
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
    ): ZodHoverResult | null | PromiseLike<ZodHoverResult | null> {
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

      const buildResult = (schemaBranch?: string): ZodHoverResult | null => {
        const parts: string[] = [];

        const base = formatFieldMetadataHover(meta, required, locale, fieldCtx.typeInfo, fieldCtx.readOnly);
        if (base) parts.push(base);

        if (schemaBranch) {
          const l = locale ?? defaultLocale;
          parts.push(`**${l.schemaBranch ?? "Schema branch"}:** ${schemaBranch}`);
        }

        if (parts.length === 0) return null;

        return {
          contents: [{ value: parts.join("\n\n") }],
          range: resolved.keyRange,
        };
      };

      if (!workerBridge?.isAvailable()) {
        return buildResult();
      }

      return workerBridge.getMatchingSchemas(model).then(
        (schemas) => {
          const matchAtOffset = schemas.find(
            (s) => s.node.offset <= offset && offset < s.node.offset + s.node.length,
          );
          const branchTitle = matchAtOffset?.schema.title as string | undefined;
          return buildResult(branchTitle);
        },
        () => buildResult(),
      );
    },
  };
}
