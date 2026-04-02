import type {
  FieldPath,
  SchemaDescriptor,
  SuggestionRefinement,
} from "@zod-monaco/core";
import {
  resolveFieldContext,
  SchemaCache,
  matchesSchemaPath,
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
import type { WorkerBridge } from "./worker-bridge.js";

export interface ZodCompletionProvider {
  triggerCharacters?: string[];
  provideCompletionItems(
    model: MonacoModelLike,
    position: MonacoPosition,
    context: MonacoCompletionContext,
  ): MonacoCompletionList | null | PromiseLike<MonacoCompletionList | null>;
}

const ENUM_MEMBER_KIND = 17;
const TEXT_KIND = 1;

function formatConstraintHint(constraints?: import("@zod-monaco/core").FieldConstraints): string | undefined {
  if (!constraints) return undefined;
  const parts: string[] = [];
  if (constraints.minLength !== undefined && constraints.maxLength !== undefined) parts.push(`${constraints.minLength}–${constraints.maxLength} chars`);
  else if (constraints.minLength !== undefined) parts.push(`min ${constraints.minLength} chars`);
  else if (constraints.maxLength !== undefined) parts.push(`max ${constraints.maxLength} chars`);
  if (constraints.minimum !== undefined && constraints.maximum !== undefined) parts.push(`${constraints.minimum}–${constraints.maximum}`);
  else if (constraints.minimum !== undefined) parts.push(`≥ ${constraints.minimum}`);
  else if (constraints.maximum !== undefined) parts.push(`≤ ${constraints.maximum}`);
  if (constraints.pattern) parts.push(`/${constraints.pattern}/`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

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
  workerBridge?: WorkerBridge,
): ZodCompletionProvider {
  const triggerCharacters = deriveTriggerCharacters(refinements);

  function buildItems(
    text: string,
    offset: number,
    ctx: NonNullable<ReturnType<typeof getValueContext>>,
    fieldPath: FieldPath,
    idx: LineIndex | undefined,
    branchEnums?: unknown[],
  ): MonacoCompletionItem[] {
    const fieldCtx = resolveFieldContext(descriptor, fieldPath, cache);

    if (fieldCtx.readOnly) return [];

    const items: MonacoCompletionItem[] = [];
    const meta = fieldCtx.metadata;

    const enumValues = branchEnums ?? fieldCtx.typeInfo.enum;
    if (Array.isArray(enumValues)) {
      const labels = meta?.enumLabels;
      const constraintHint = formatConstraintHint(meta?.constraints);
      for (let i = 0; i < enumValues.length; i++) {
        const val = enumValues[i];
        const enumLabel = labels?.[String(val)];
        const detail = constraintHint
          ? enumLabel ? `${enumLabel} (${constraintHint})` : constraintHint
          : enumLabel;
        if (ctx.insideString && typeof val === "string") {
          items.push({
            label: String(val),
            kind: ENUM_MEMBER_KIND,
            detail,
            insertText: val,
            sortText: String(i).padStart(4, "0"),
            range: makePosition(text, ctx.innerStart, ctx.innerEnd, idx),
          });
        } else {
          items.push({
            label: String(val),
            kind: ENUM_MEMBER_KIND,
            detail,
            insertText: JSON.stringify(val),
            sortText: String(i).padStart(4, "0"),
            range: makePosition(text, ctx.valueStart, ctx.valueEnd, idx),
          });
        }
      }
    }

    if (items.length === 0 && refinements?.length) {
      for (const ref of refinements) {
        if (!matchesSchemaPath(fieldPath, ref.path as readonly string[]))
          continue;

        if (ref.triggerPattern && ctx.insideString) {
          const textBeforeCursor = text.slice(ctx.innerStart, offset);
          if (!new RegExp(ref.triggerPattern).test(textBeforeCursor))
            continue;
        }

        const range = ctx.insideString
          ? makePosition(text, ctx.innerStart, ctx.innerEnd, idx)
          : makePosition(text, ctx.valueStart, ctx.valueEnd, idx);

        for (let i = 0; i < ref.suggestions.length; i++) {
          const suggestion = ref.suggestions[i]!;
          items.push({
            label: suggestion,
            kind: TEXT_KIND,
            insertText: ctx.insideString
              ? suggestion
              : JSON.stringify(suggestion),
            sortText: `z${String(i).padStart(4, "0")}`,
            range,
          });
        }
      }
    }

    return items;
  }

  return {
    triggerCharacters,
    provideCompletionItems(
      model: MonacoModelLike,
      position: MonacoPosition,
    ): MonacoCompletionList | null | PromiseLike<MonacoCompletionList | null> {
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

      const fieldPath: FieldPath = ctx.path;

      const toResult = (items: MonacoCompletionItem[]): MonacoCompletionList | null =>
        items.length > 0 ? { suggestions: items } : null;

      if (!workerBridge?.isAvailable()) {
        return toResult(buildItems(text, offset, ctx, fieldPath, idx));
      }

      return workerBridge.getMatchingSchemas(model).then(
        (schemas) => {
          const matchAtOffset = schemas.find(
            (s) => s.node.offset <= offset && offset < s.node.offset + s.node.length,
          );
          const branchEnum = matchAtOffset?.schema.enum as unknown[] | undefined;
          return toResult(buildItems(text, offset, ctx, fieldPath, idx, branchEnum));
        },
        () => toResult(buildItems(text, offset, ctx, fieldPath, idx)),
      );
    },
  };
}
