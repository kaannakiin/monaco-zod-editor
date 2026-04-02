import type { SchemaDescriptor, SuggestionRefinement, ZodIssue } from "@zod-monaco/core";
import type { FeatureToggles, ValidationResult } from "./types.js";
import type { ZodMonacoLocale } from "./locale.js";
import type { RawMonaco, RawMonacoEditor } from "./raw-types.js";
import type {
  MonacoApi,
  MonacoDisposable,
  MonacoEditorChangeEvent,
  MonacoStandaloneEditorLike,
} from "./monaco-types.js";
import { resolveJsonPath } from "./json-path-position.js";
import { attachZodToEditor } from "./attach.js";
import type { ZodEditorAttachment } from "./attach.js";

export type { FeatureToggles } from "./types.js";
export type { ZodMonacoLocale } from "./locale.js";
export { locales, defaultLocale } from "./locale.js";
export type { JsonPosition, ValueContext, PathSegment } from "./json-path-position.js";
export {
  resolveJsonPath,
  resolvePathAtOffset,
  collectPathsInRange,
  getValueContext,
  positionToOffset,
  LineIndex,
} from "./json-path-position.js";
export { buildBreadcrumbSegments } from "./breadcrumb.js";
export type { BreadcrumbSegment } from "./breadcrumb.js";
export { formatFieldMetadataHover } from "./hover.js";
export type { ZodHoverResult, ZodHoverProvider } from "./hover.js";
export { createZodCompletionProvider } from "./completions.js";
export type { ZodCompletionProvider } from "./completions.js";
export { loadMonaco } from "./load-monaco.js";
export type { LoadMonacoOptions } from "./load-monaco.js";
export type { RawMonaco, RawMonacoEditor, RawMonacoEditorApi } from "./raw-types.js";
export type { ZodIssue } from "@zod-monaco/core";
export type {
  MonacoDisposable,
  MonacoPosition,
  MonacoRange,
  MonacoSelection,
  MonacoModelLike,
  MonacoEditorChangeEvent,
  MonacoStandaloneEditorLike,
  MonacoMarkerData,
  MonacoCompletionItem,
  MonacoCompletionList,
  MonacoCompletionContext,
  MonacoJsonDiagnosticsOptions,
  MonacoEditorApi,
  MonacoLanguageRegistration,
  MonacoApi,
} from "./monaco-types.js";

export type { ValidationResult } from "./types.js";
export type { SuggestionRefinement } from "@zod-monaco/core";
export { attachZodToEditor } from "./attach.js";
export type { AttachZodOptions, ZodEditorAttachment } from "./attach.js";
export { getSchemaRegistry } from "./schema-registry.js";
export type { ZodSchemaRegistry, SchemaRegistration, SchemaEntry } from "./schema-registry.js";
export { createZodHoverProvider } from "./hover.js";
export { prepareJsonEdit } from "./json-edit.js";
export type { PreparedEdit, ValidationIssue, ReadOnlyViolation } from "./json-edit.js";

const DEFAULT_EDITOR_LANGUAGE = "json";

export interface CreateZodEditorControllerOptions {
  monaco: MonacoApi;
  descriptor?: SchemaDescriptor;
  features?: FeatureToggles;
  locale?: ZodMonacoLocale;
  value?: string;
  editorOptions?: Record<string, unknown>;
  validationDelay?: number;
  refinements?: readonly SuggestionRefinement[];
  onReadOnlyViolation?: (path: import("@zod-monaco/core").FieldPath) => void;
  /** Base Monaco JSON diagnostics options merged under registry-managed fields. */
  diagnosticsOptions?: import("./monaco-types.js").MonacoJsonDiagnosticsOptions;
}

export interface ZodEditorController extends MonacoDisposable {
  mount(element: HTMLElement): MonacoStandaloneEditorLike;
  getEditor(): MonacoStandaloneEditorLike | null;
  getValue(): string;
  setValue(value: string): void;
  setDescriptor(descriptor: SchemaDescriptor | null): void;
  setRefinements(refinements: readonly SuggestionRefinement[]): void;
  onChange(
    listener: (value: string, event: MonacoEditorChangeEvent) => void,
  ): MonacoDisposable;
  onValidationChange(
    listener: (result: ValidationResult) => void,
  ): MonacoDisposable;
  onCursorPathChange(
    listener: (segments: import("./breadcrumb.js").BreadcrumbSegment[]) => void,
  ): MonacoDisposable;
  revealIssue(issue: ZodIssue): void;
  revealPath(path: PropertyKey[]): void;
  format(): boolean;
  /** Update editor options at runtime without remounting (e.g. fontSize, readOnly). */
  updateOptions(options: Record<string, unknown>): void;
  /** Access the full Monaco namespace for native APIs like `defineTheme`, `setTheme`, etc. */
  getMonaco(): RawMonaco;
  /** Access the full underlying editor instance with all native methods. */
  getRawEditor(): RawMonacoEditor | null;
}

class DefaultZodEditorController implements ZodEditorController {
  readonly #listeners = new Set<
    (value: string, event: MonacoEditorChangeEvent) => void
  >();
  readonly #validationListeners = new Set<
    (result: ValidationResult) => void
  >();
  readonly #cursorPathListeners = new Set<
    (segments: import("./breadcrumb.js").BreadcrumbSegment[]) => void
  >();

  readonly #monaco: MonacoApi;
  readonly #editorOptions: Record<string, unknown>;
  readonly #features: FeatureToggles | undefined;
  readonly #locale: ZodMonacoLocale | undefined;
  readonly #validationDelay: number | undefined;
  readonly #onReadOnlyViolation: ((path: import("@zod-monaco/core").FieldPath) => void) | undefined;
  readonly #diagnosticsOptions: import("./monaco-types.js").MonacoJsonDiagnosticsOptions | undefined;

  #editor: MonacoStandaloneEditorLike | null = null;
  #changeDisposable: MonacoDisposable | null = null;
  #attachment: ZodEditorAttachment | null = null;
  #attachValidationDisposable: MonacoDisposable | null = null;
  #attachCursorDisposable: MonacoDisposable | null = null;
  #descriptor: SchemaDescriptor | null;
  #refinements: readonly SuggestionRefinement[];
  #value: string;

  constructor(options: CreateZodEditorControllerOptions) {
    this.#monaco = options.monaco;
    this.#editorOptions = options.editorOptions ?? {};
    this.#value = options.value ?? "";
    this.#descriptor = options.descriptor ?? null;
    this.#refinements = options.refinements ?? [];
    this.#locale = options.locale;
    this.#validationDelay = options.validationDelay;
    this.#features = options.features;
    this.#onReadOnlyViolation = options.onReadOnlyViolation;
    this.#diagnosticsOptions = options.diagnosticsOptions;
  }

  mount(element: HTMLElement): MonacoStandaloneEditorLike {
    if (this.#editor) {
      return this.#editor;
    }

    this.#editor = this.#monaco.editor.create(element, {
      automaticLayout: true,
      language: DEFAULT_EDITOR_LANGUAGE,
      value: this.#value,
      ...this.#editorOptions,
    });

    this.#attachment = attachZodToEditor({
      monaco: this.#monaco,
      editor: this.#editor,
      descriptor: this.#descriptor,
      features: this.#features,
      locale: this.#locale,
      validationDelay: this.#validationDelay,
      refinements: this.#refinements,
      onReadOnlyViolation: this.#onReadOnlyViolation,
      diagnosticsOptions: this.#diagnosticsOptions,
    });

    this.#changeDisposable = this.#editor.onDidChangeModelContent((event) => {
      this.#value = this.#editor?.getValue() ?? "";

      for (const listener of this.#listeners) {
        listener(this.#value, event);
      }
    });

    this.#attachValidationDisposable = this.#attachment.onValidationChange((result) => {
      for (const l of this.#validationListeners) l(result);
    });

    this.#attachCursorDisposable = this.#attachment.onCursorPathChange((segments) => {
      for (const l of this.#cursorPathListeners) l(segments);
    });

    this.#editor.addCommand(
      this.#monaco.KeyMod.CtrlCmd | this.#monaco.KeyCode.KeyS,
      () => {
        this.format();
      },
    );

    return this.#editor;
  }

  getEditor(): MonacoStandaloneEditorLike | null {
    return this.#editor;
  }

  getValue(): string {
    return this.#editor?.getValue() ?? this.#value;
  }

  setValue(value: string): void {
    this.#value = value;

    if (!this.#editor || this.#editor.getValue() === value) {
      return;
    }

    this.#editor.setValue(value);
  }

  setDescriptor(descriptor: SchemaDescriptor | null): void {
    this.#descriptor = descriptor;
    this.#attachment?.setDescriptor(descriptor);
  }

  setRefinements(refinements: readonly SuggestionRefinement[]): void {
    this.#refinements = refinements;
    this.#attachment?.setRefinements(refinements);
  }

  onChange(
    listener: (value: string, event: MonacoEditorChangeEvent) => void,
  ): MonacoDisposable {
    this.#listeners.add(listener);

    return {
      dispose: () => {
        this.#listeners.delete(listener);
      },
    };
  }

  onValidationChange(
    listener: (result: ValidationResult) => void,
  ): MonacoDisposable {
    this.#validationListeners.add(listener);

    return {
      dispose: () => {
        this.#validationListeners.delete(listener);
      },
    };
  }

  onCursorPathChange(
    listener: (segments: import("./breadcrumb.js").BreadcrumbSegment[]) => void,
  ): MonacoDisposable {
    this.#cursorPathListeners.add(listener);

    return {
      dispose: () => {
        this.#cursorPathListeners.delete(listener);
      },
    };
  }

  revealIssue(issue: ZodIssue): void {
    const editor = this.#editor;
    if (!editor) return;
    const text = editor.getValue();
    const position = resolveJsonPath(text, issue.path);
    if (position) {
      setTimeout(() => {
        editor.focus();
        editor.setPosition({ lineNumber: position.startLineNumber, column: position.startColumn });
        editor.revealLineInCenter(position.startLineNumber);
      }, 0);
    }
  }

  revealPath(path: PropertyKey[]): void {
    const editor = this.#editor;
    if (!editor) return;
    const text = editor.getValue();
    const position = resolveJsonPath(text, path);
    if (position) {
      setTimeout(() => {
        editor.focus();
        editor.setPosition({ lineNumber: position.startLineNumber, column: position.startColumn });
        editor.revealLineInCenter(position.startLineNumber);
      }, 0);
    }
  }

  format(): boolean {
    const editor = this.#editor;
    if (!editor) return false;

    const raw = editor.getValue();
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return false;
    }

    const formatted = JSON.stringify(parsed, null, 2);
    if (formatted !== raw) {
      editor.setValue(formatted);
    }
    return true;
  }

  updateOptions(options: Record<string, unknown>): void {
    this.#editor?.updateOptions?.(options);
  }

  getMonaco(): RawMonaco {
    return this.#monaco as RawMonaco;
  }

  getRawEditor(): RawMonacoEditor | null {
    return this.#editor as RawMonacoEditor | null;
  }

  dispose(): void {
    this.#attachValidationDisposable?.dispose();
    this.#attachValidationDisposable = null;

    this.#attachCursorDisposable?.dispose();
    this.#attachCursorDisposable = null;

    this.#attachment?.dispose();
    this.#attachment = null;

    this.#changeDisposable?.dispose();
    this.#changeDisposable = null;

    this.#editor?.dispose();
    this.#editor = null;

    this.#listeners.clear();
    this.#validationListeners.clear();
    this.#cursorPathListeners.clear();
  }
}

export function createZodEditorController(
  options: CreateZodEditorControllerOptions,
): ZodEditorController {
  return new DefaultZodEditorController(options);
}
