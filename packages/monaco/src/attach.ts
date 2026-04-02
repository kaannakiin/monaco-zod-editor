import type {
  SchemaDescriptor,
  SuggestionRefinement,
  ZodIssue,
  FieldPath,
} from "@zod-monaco/core";
import {
  SchemaCache,
  isFieldReadOnly,
  diffPathCoversReadOnlyDescendant,
} from "@zod-monaco/core";
import type { FeatureToggles, ValidationResult } from "./types.js";
import type { ZodMonacoLocale } from "./locale.js";
import type {
  MonacoApi,
  MonacoDisposable,
  MonacoEditorChangeEvent,
  MonacoJsonDiagnosticsOptions,
  MonacoMarkerData,
  MonacoStandaloneEditorLike,
} from "./monaco-types.js";
import type { BreadcrumbSegment } from "./breadcrumb.js";
import {
  resolveJsonPath,
  positionToOffset,
  resolvePathAtOffset,
  collectPathsInRange,
  LineIndex,
} from "./json-path-position.js";
import { createZodHoverProvider } from "./hover.js";
import { createZodCompletionProvider } from "./completions.js";
import { buildBreadcrumbSegments } from "./breadcrumb.js";
import { getSchemaRegistry } from "./schema-registry.js";
import type { SchemaRegistration } from "./schema-registry.js";
import { createWorkerBridge } from "./worker-bridge.js";
import type { WorkerBridge } from "./worker-bridge.js";

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
  refinements?: readonly SuggestionRefinement[];
  onReadOnlyViolation?: (path: FieldPath) => void;
  /** Base Monaco JSON diagnostics options merged under registry-managed fields (validate, schemas, enableSchemaRequest). */
  diagnosticsOptions?: MonacoJsonDiagnosticsOptions;
  /** Disable worker-based enhancements (falls back to sync-only parser). */
  disableWorker?: boolean;
}

export interface ZodEditorAttachment extends MonacoDisposable {
  setDescriptor(descriptor: SchemaDescriptor | null): void;
  setRefinements(refinements: readonly SuggestionRefinement[]): void;
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
  let refinements: readonly SuggestionRefinement[] = options.refinements ?? [];
  let schemaCache: SchemaCache | null = descriptor
    ? new SchemaCache(descriptor.jsonSchema)
    : null;
  let lineIndex: LineIndex | null = null;
  let hoverDisposable: MonacoDisposable | null = null;
  let completionDisposable: MonacoDisposable | null = null;
  let schemaRegistration: SchemaRegistration | null = null;
  let validationTimeout: ReturnType<typeof setTimeout> | null = null;

  const workerBridge: WorkerBridge | undefined = options.disableWorker
    ? undefined
    : createWorkerBridge(monaco);

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

  if (options.diagnosticsOptions) {
    getSchemaRegistry(monaco).setBaseOptions(options.diagnosticsOptions);
  }

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
        workerBridge,
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
        refinements.length > 0 ? refinements : undefined,
        workerBridge,
      ),
    );
  }

  function scheduleValidation(): void {
    if (!features.diagnostics || !descriptor) {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      }
      const vResult: ValidationResult = { valid: true, issues: [] };
      for (const l of validationListeners) l(vResult);
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
    if (!descriptor) {
      const vResult: ValidationResult = { valid: true, issues: [] };
      for (const l of validationListeners) l(vResult);
      return;
    }

    const model = editor.getModel();
    if (!model) {
      const vResult: ValidationResult = { valid: true, issues: [] };
      for (const l of validationListeners) l(vResult);
      return;
    }

    const text = model.getValue();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      const message = e instanceof SyntaxError ? e.message : "Invalid JSON";
      monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      const vResult: ValidationResult = {
        valid: false,
        issues: [],
        parseError: message,
      };
      for (const l of validationListeners) l(vResult);
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
    const issues = result.error.issues;

    const applyMarkers = (markers: MonacoMarkerData[]) => {
      monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
      const vResult: ValidationResult = { valid: false, issues };
      for (const l of validationListeners) l(vResult);
    };

    if (workerBridge?.isAvailable()) {
      workerBridge.getDocument(model).then(
        (doc) => {
          const markers = issues
            .map((issue) => {
              if (doc?.root && issue.path.length > 0) {
                const syncPos = resolveJsonPath(text, issue.path, validationIndex);
                if (syncPos) {
                  return {
                    severity: monaco.MarkerSeverity.Error,
                    message: issue.message,
                    ...syncPos,
                    source: MARKER_OWNER,
                  } satisfies MonacoMarkerData;
                }
              }
              return issueToMarker(text, issue, validationIndex);
            })
            .filter((m): m is MonacoMarkerData => m !== null);
          applyMarkers(markers);
        },
        () => {
          const markers = issues
            .map((issue) => issueToMarker(text, issue, validationIndex))
            .filter((m): m is MonacoMarkerData => m !== null);
          applyMarkers(markers);
        },
      );
    } else {
      const markers = issues
        .map((issue) => issueToMarker(text, issue, validationIndex))
        .filter((m): m is MonacoMarkerData => m !== null);
      applyMarkers(markers);
    }
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

  let previousText: string = editor.getValue();
  let isUndoingReadOnly = false;

  function revertToText(text: string): void {
    if (typeof editor.trigger === "function") {
      editor.trigger("readOnlyGuard", "undo", null);
      return;
    }
    const model = editor.getModel();
    if (!model) return;
    editor.executeEdits("readOnly-revert", [
      { range: model.getFullModelRange(), text, forceMoveMarkers: false },
    ]);
  }

  function guardReadOnlyEdit(event: MonacoEditorChangeEvent): void {
    if (isUndoingReadOnly) {
      isUndoingReadOnly = false;
      previousText = editor.getValue();
      return;
    }

    if (!descriptor) {
      previousText = editor.getValue();
      return;
    }

    const meta = descriptor.metadata;
    if (
      !meta.readOnly &&
      (!meta.readOnlyPaths || meta.readOnlyPaths.size === 0)
    ) {
      previousText = editor.getValue();
      return;
    }

    if (meta.readOnly) {
      isUndoingReadOnly = true;
      options.onReadOnlyViolation?.([] as unknown as FieldPath);
      revertToText(previousText);
      return;
    }

    const changes = event.changes as
      | ReadonlyArray<{ rangeOffset: number; rangeLength: number }>
      | undefined;
    if (!changes?.length) {
      previousText = editor.getValue();
      return;
    }

    let touchesReadOnly = false;
    let violatingPath: FieldPath = [];

    outer: for (const change of changes) {
      const paths =
        change.rangeLength === 0
          ? (() => {
              const r = resolvePathAtOffset(previousText, change.rangeOffset);
              return r ? [r.path] : [];
            })()
          : collectPathsInRange(
              previousText,
              change.rangeOffset,
              change.rangeLength,
            );

      for (const fieldPath of paths) {

        if (
          isFieldReadOnly(meta, fieldPath) ||
          (meta.readOnlyPaths &&
            diffPathCoversReadOnlyDescendant(fieldPath, meta.readOnlyPaths))
        ) {
          touchesReadOnly = true;
          violatingPath = fieldPath;
          break outer;
        }
      }
    }

    if (touchesReadOnly) {
      isUndoingReadOnly = true;
      options.onReadOnlyViolation?.(violatingPath);
      revertToText(previousText);
      return;
    }

    previousText = editor.getValue();
  }

  const changeDisposable = editor.onDidChangeModelContent((event) => {
    lineIndex = null;
    guardReadOnlyEdit(event);
    scheduleValidation();
  });

  if (features.hover || features.completions) {
    monaco.languages.json.jsonDefaults.setModeConfiguration?.({
      hovers: !features.hover,
      completionItems: !features.completions,
      documentFormattingEdits: true,
      documentSymbols: true,
      foldingRanges: true,
      diagnostics: true,
      selectionRanges: true,
      tokens: true,
      colors: true,
    });
  }

  applyJsonSchema();
  registerHoverProvider();
  registerCompletionProvider();
  scheduleValidation();

  return {
    setDescriptor(newDescriptor: SchemaDescriptor | null): void {
      descriptor = newDescriptor;
      schemaCache = descriptor ? new SchemaCache(descriptor.jsonSchema) : null;
      previousText = editor.getValue();
      applyJsonSchema();
      registerHoverProvider();
      registerCompletionProvider();
      scheduleValidation();
    },

    setRefinements(newRefinements: readonly SuggestionRefinement[]): void {
      refinements = newRefinements;
      registerCompletionProvider();
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

      workerBridge?.dispose();

      validationListeners.clear();
      cursorPathListeners.clear();
    },
  };
}
