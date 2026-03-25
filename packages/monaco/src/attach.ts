import type { SchemaDescriptor, ZodIssue } from "@zod-monaco/core";
import { SchemaCache } from "@zod-monaco/core";
import type { FeatureToggles, ValidationResult } from "./types.js";
import type { ZodMonacoLocale } from "./locale.js";
import type {
  MonacoApi,
  MonacoDisposable,
  MonacoMarkerData,
  MonacoStandaloneEditorLike,
} from "./monaco-types.js";
import type { BreadcrumbSegment } from "./breadcrumb.js";
import {
  resolveJsonPath,
  positionToOffset,
  resolvePathAtOffset,
  LineIndex,
} from "./json-path-position.js";
import { createZodHoverProvider } from "./hover.js";
import { createZodCompletionProvider } from "./completions.js";
import { buildBreadcrumbSegments } from "./breadcrumb.js";
import { getSchemaRegistry } from "./schema-registry.js";
import type { SchemaRegistration } from "./schema-registry.js";

const DEFAULT_EDITOR_LANGUAGE = "json";
const DEFAULT_VALIDATION_DELAY = 300;
const MARKER_OWNER = "zod-monaco";

export interface AttachZodOptions {
  monaco: MonacoApi;
  editor: MonacoStandaloneEditorLike;
  descriptor?: SchemaDescriptor | null;
  features?: FeatureToggles;
  locale?: ZodMonacoLocale;
  validationDelay?: number;
}

export interface ZodEditorAttachment extends MonacoDisposable {
  setDescriptor(descriptor: SchemaDescriptor | null): void;
  onValidationChange(
    listener: (result: ValidationResult) => void,
  ): MonacoDisposable;
  onCursorPathChange(
    listener: (segments: BreadcrumbSegment[]) => void,
  ): MonacoDisposable;
}

export function attachZodToEditor(
  options: AttachZodOptions,
): ZodEditorAttachment {
  const { monaco, editor } = options;
  const features: Required<FeatureToggles> = {
    hover: options.features?.hover ?? true,
    validation: options.features?.validation ?? true,
    completions: options.features?.completions ?? true,
    diagnostics: options.features?.diagnostics ?? true,
  };
  const locale = options.locale;
  const validationDelay = options.validationDelay ?? DEFAULT_VALIDATION_DELAY;
  const schemaUri = `internal://zod-monaco/${crypto.randomUUID()}.json`;

  let descriptor: SchemaDescriptor | null = options.descriptor ?? null;
  let schemaCache: SchemaCache | null = descriptor
    ? new SchemaCache(descriptor.jsonSchema)
    : null;
  let lineIndex: LineIndex | null = null;
  let hoverDisposable: MonacoDisposable | null = null;
  let completionDisposable: MonacoDisposable | null = null;
  let schemaRegistration: SchemaRegistration | null = null;
  let validationTimeout: ReturnType<typeof setTimeout> | null = null;

  function getLineIndex(): LineIndex {
    if (!lineIndex) {
      lineIndex = new LineIndex(editor.getValue());
    }
    return lineIndex;
  }

  const validationListeners = new Set<(result: ValidationResult) => void>();
  const cursorPathListeners = new Set<
    (segments: BreadcrumbSegment[]) => void
  >();

  function applyJsonSchema(): void {
    if (!descriptor || !features.validation) {
      clearJsonSchema();
      return;
    }

    const model = editor.getModel();
    const fileMatch = model ? [model.uri.toString()] : ["*"];
    const entry = { uri: schemaUri, fileMatch, schema: descriptor.jsonSchema };

    if (schemaRegistration) {
      schemaRegistration.update(entry);
    } else {
      schemaRegistration = getSchemaRegistry(monaco).register(entry);
    }
  }

  function clearJsonSchema(): void {
    if (schemaRegistration) {
      schemaRegistration.dispose();
      schemaRegistration = null;
    }
  }

  function registerHoverProvider(): void {
    hoverDisposable?.dispose();
    hoverDisposable = null;

    if (!features.hover || !descriptor) return;

    const model = editor.getModel();
    if (!model) return;

    hoverDisposable = monaco.languages.registerHoverProvider(
      DEFAULT_EDITOR_LANGUAGE,
      createZodHoverProvider(
        descriptor,
        model.uri.toString(),
        locale,
        schemaCache ?? undefined,
        () => lineIndex,
      ),
    );
  }

  function registerCompletionProvider(): void {
    completionDisposable?.dispose();
    completionDisposable = null;

    if (!features.completions || !descriptor) return;

    const model = editor.getModel();
    if (!model) return;

    completionDisposable = monaco.languages.registerCompletionItemProvider(
      DEFAULT_EDITOR_LANGUAGE,
      createZodCompletionProvider(
        descriptor,
        model.uri.toString(),
        schemaCache ?? undefined,
        () => lineIndex,
      ),
    );
  }

  function scheduleValidation(): void {
    if (!features.diagnostics || !descriptor) {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      }
      return;
    }

    if (validationTimeout) {
      clearTimeout(validationTimeout);
    }

    validationTimeout = setTimeout(() => {
      runValidation();
    }, validationDelay);
  }

  function runValidation(): void {
    if (!descriptor) return;

    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      return;
    }

    const result = descriptor.validate(parsed);

    if (result.success) {
      monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      const vResult: ValidationResult = { valid: true, issues: [] };
      for (const l of validationListeners) l(vResult);
      return;
    }

    const validationIndex = getLineIndex();
    const markers = result.error.issues
      .map((issue) => issueToMarker(text, issue, validationIndex))
      .filter((m): m is MonacoMarkerData => m !== null);

    monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    const vResult: ValidationResult = {
      valid: false,
      issues: result.error.issues,
    };
    for (const l of validationListeners) l(vResult);
  }

  function issueToMarker(
    text: string,
    issue: ZodIssue,
    idx?: LineIndex,
  ): MonacoMarkerData | null {
    const position = resolveJsonPath(text, issue.path, idx);

    if (!position) {
      return {
        severity: monaco.MarkerSeverity.Error,
        message:
          issue.path.length > 0
            ? `${issue.path.join(".")}: ${issue.message}`
            : issue.message,
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 2,
        source: MARKER_OWNER,
      };
    }

    return {
      severity: monaco.MarkerSeverity.Error,
      message: issue.message,
      ...position,
      source: MARKER_OWNER,
    };
  }

  const cursorDisposable = editor.onDidChangeCursorPosition((event) => {
    if (cursorPathListeners.size === 0) return;
    const text = editor.getValue();
    const idx = getLineIndex();
    const offset = positionToOffset(
      text,
      event.position.lineNumber,
      event.position.column,
      idx,
    );
    const result = resolvePathAtOffset(text, offset);
    const segments = buildBreadcrumbSegments(result?.path ?? []);
    for (const listener of cursorPathListeners) {
      listener(segments);
    }
  });

  const changeDisposable = editor.onDidChangeModelContent(() => {
    lineIndex = null;
    scheduleValidation();
  });

  applyJsonSchema();
  registerHoverProvider();
  registerCompletionProvider();
  scheduleValidation();

  return {
    setDescriptor(newDescriptor: SchemaDescriptor | null): void {
      descriptor = newDescriptor;
      schemaCache = descriptor ? new SchemaCache(descriptor.jsonSchema) : null;
      applyJsonSchema();
      registerHoverProvider();
      registerCompletionProvider();
      scheduleValidation();
    },

    onValidationChange(
      listener: (result: ValidationResult) => void,
    ): MonacoDisposable {
      validationListeners.add(listener);
      return {
        dispose: () => {
          validationListeners.delete(listener);
        },
      };
    },

    onCursorPathChange(
      listener: (segments: BreadcrumbSegment[]) => void,
    ): MonacoDisposable {
      cursorPathListeners.add(listener);
      return {
        dispose: () => {
          cursorPathListeners.delete(listener);
        },
      };
    },

    dispose(): void {
      if (validationTimeout) {
        clearTimeout(validationTimeout);
        validationTimeout = null;
      }

      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      }

      clearJsonSchema();

      hoverDisposable?.dispose();
      hoverDisposable = null;

      completionDisposable?.dispose();
      completionDisposable = null;

      cursorDisposable.dispose();
      changeDisposable.dispose();

      validationListeners.clear();
      cursorPathListeners.clear();
    },
  };
}
