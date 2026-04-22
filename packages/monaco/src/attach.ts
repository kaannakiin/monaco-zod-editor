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
import type { FeatureToggles, ValidationResult, ReadOnlyViolationDetail } from "./types.js";
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
  resolvePathAtOffset,
  collectPathsInRange,
} from "./json-path-position.js";
import { createZodHoverProvider } from "./hover.js";
import { createZodCompletionProvider } from "./completions.js";
import { buildBreadcrumbSegments, buildBreadcrumbLabelCache } from "./breadcrumb.js";
import type { BreadcrumbLabelCache } from "./breadcrumb.js";
import { getSchemaRegistry } from "./schema-registry.js";
import type { SchemaRegistration } from "./schema-registry.js";
import { createWorkerBridge, findNodeByPath } from "./worker-bridge.js";
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
  onReadOnlyViolation?: (detail: ReadOnlyViolationDetail) => void;
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
  let hoverDisposable: MonacoDisposable | null = null;
  let completionDisposable: MonacoDisposable | null = null;
  let schemaRegistration: SchemaRegistration | null = null;
  let validationTimeout: ReturnType<typeof setTimeout> | null = null;

  const workerBridge: WorkerBridge | undefined = options.disableWorker
    ? undefined
    : createWorkerBridge(monaco);

  let breadcrumbLabelCache: BreadcrumbLabelCache | null = descriptor
    ? buildBreadcrumbLabelCache(descriptor)
    : null;

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

    const issues = result.error.issues;

    const applyMarkers = (markers: MonacoMarkerData[]) => {
      monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
      const vResult: ValidationResult = { valid: false, issues };
      for (const l of validationListeners) l(vResult);
    };

    const buildFallbackMarkers = () =>
      issues
        .map((issue) => issueToMarker(model, text, issue))
        .filter((m): m is MonacoMarkerData => m !== null);

    if (!workerBridge?.isAvailable()) {
      applyMarkers(buildFallbackMarkers());
      return;
    }

    workerBridge.getDocument(model).then(
      (doc) => {
        if (!doc?.root) {
          applyMarkers(buildFallbackMarkers());
          return;
        }
        const markers = issues
          .map((issue) => {
            if (issue.path.length > 0) {
              const node = findNodeByPath(doc, issue.path);
              if (node) {
                const startPos = model.getPositionAt(node.offset);
                const endPos = model.getPositionAt(node.offset + node.length);
                return {
                  severity: monaco.MarkerSeverity.Error,
                  message: issue.message,
                  startLineNumber: startPos.lineNumber,
                  startColumn: startPos.column,
                  endLineNumber: endPos.lineNumber,
                  endColumn: endPos.column,
                  source: MARKER_OWNER,
                } satisfies MonacoMarkerData;
              }
            }
            return issueToMarker(model, text, issue);
          })
          .filter((m): m is MonacoMarkerData => m !== null);
        applyMarkers(markers);
      },
      () => applyMarkers(buildFallbackMarkers()),
    );
  }

  function issueToMarker(
    model: NonNullable<ReturnType<typeof editor.getModel>>,
    text: string,
    issue: ZodIssue,
  ): MonacoMarkerData | null {
    const position = resolveJsonPath(text, issue.path);

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

    const startPos = model.getPositionAt(position.start);
    const endPos = model.getPositionAt(position.end);
    return {
      severity: monaco.MarkerSeverity.Error,
      message: issue.message,
      startLineNumber: startPos.lineNumber,
      startColumn: startPos.column,
      endLineNumber: endPos.lineNumber,
      endColumn: endPos.column,
      source: MARKER_OWNER,
    };
  }

  let cursorTimeout: ReturnType<typeof setTimeout> | null = null;
  const CURSOR_DEBOUNCE_MS = 50;

  const cursorDisposable = editor.onDidChangeCursorPosition((event) => {
    if (cursorPathListeners.size === 0) return;
    if (cursorTimeout) clearTimeout(cursorTimeout);
    cursorTimeout = setTimeout(() => {
      const model = editor.getModel();
      if (!model) return;
      const text = model.getValue();
      const offset = model.getOffsetAt(event.position);
      const result = resolvePathAtOffset(text, offset);
      const segments = buildBreadcrumbSegments(result?.path ?? [], descriptor, schemaCache, breadcrumbLabelCache);
      for (const listener of cursorPathListeners) {
        listener(segments);
      }
    }, CURSOR_DEBOUNCE_MS);
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

  function detectOperation(
    changes: ReadonlyArray<{ rangeOffset: number; rangeLength: number; text?: string }>,
  ): ReadOnlyViolationDetail["operation"] {
    if (changes.length > 1) return "replace";
    const c = changes[0]!;
    if (c.rangeLength === 0) return c.text?.includes("\n") ? "paste" : "type";
    if (!c.text || c.text.length === 0) return "delete";
    if (c.text.length > c.rangeLength * 2 || c.text.includes("\n")) return "paste";
    return "type";
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
      options.onReadOnlyViolation?.({
        path: [] as unknown as FieldPath,
        operation: "type",
      });
      revertToText(previousText);
      return;
    }

    const changes = event.changes as
      | ReadonlyArray<{ rangeOffset: number; rangeLength: number; text?: string }>
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
      const operation = detectOperation(changes);
      options.onReadOnlyViolation?.({ path: violatingPath, operation });
      revertToText(previousText);
      return;
    }

    previousText = editor.getValue();
  }

  const changeDisposable = editor.onDidChangeModelContent((event) => {
    guardReadOnlyEdit(event);
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
      breadcrumbLabelCache = descriptor ? buildBreadcrumbLabelCache(descriptor) : null;
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
      if (cursorTimeout) {
        clearTimeout(cursorTimeout);
        cursorTimeout = null;
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
