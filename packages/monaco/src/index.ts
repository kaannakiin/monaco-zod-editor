import type { SchemaDescriptor, ZodIssue } from "@zod-monaco/core";
import type { FeatureToggles } from "./types.js";
import { resolveJsonPath } from "./json-path-position.js";
import { createZodHoverProvider } from "./hover.js";
import { createZodCompletionProvider } from "./completions.js";

export type { FeatureToggles } from "./types.js";
export type { JsonPosition, ValueContext } from "./json-path-position.js";
export {
  resolveJsonPath,
  resolvePathAtOffset,
  getValueContext,
  positionToOffset,
} from "./json-path-position.js";
export { formatFieldMetadataHover } from "./hover.js";
export type { ZodHoverResult, ZodHoverProvider } from "./hover.js";
export { createZodCompletionProvider } from "./completions.js";
export type { ZodCompletionProvider } from "./completions.js";
export { loadMonaco } from "./load-monaco.js";
export type { LoadMonacoOptions } from "./load-monaco.js";
export type { ZodIssue } from "@zod-monaco/core";

export interface ValidationResult {
  valid: boolean;
  issues: ZodIssue[];
}

export interface MonacoDisposable {
  dispose(): void;
}

export interface MonacoPosition {
  lineNumber: number;
  column: number;
}

export interface MonacoModelLike {
  readonly uri: { toString(): string };
  getValue(): string;
  getPositionAt(offset: number): MonacoPosition;
}

export interface MonacoEditorChangeEvent {
  readonly changes?: readonly unknown[];
}

export interface MonacoStandaloneEditorLike extends MonacoDisposable {
  getModel(): MonacoModelLike | null;
  getValue(): string;
  setValue(value: string): void;
  onDidChangeModelContent(
    listener: (event: MonacoEditorChangeEvent) => void,
  ): MonacoDisposable;
  addCommand(keybinding: number, handler: () => void): string | null;
  revealLineInCenter(lineNumber: number): void;
  setPosition(position: { lineNumber: number; column: number }): void;
  focus(): void;
}

export interface MonacoMarkerData {
  severity: number;
  message: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  source?: string;
}

export interface MonacoCompletionItem {
  label: string;
  kind: number;
  detail?: string;
  insertText: string;
  sortText?: string;
  range?: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
}

export interface MonacoCompletionList {
  suggestions: MonacoCompletionItem[];
}

export interface MonacoCompletionContext {
  triggerKind: number;
}

export interface MonacoJsonDiagnosticsOptions {
  validate?: boolean;
  schemas?: Array<{
    uri: string;
    fileMatch: string[];
    schema: Record<string, unknown>;
  }>;
  enableSchemaRequest?: boolean;
}

export interface MonacoEditorApi {
  create(
    element: HTMLElement,
    options: Record<string, unknown>,
  ): MonacoStandaloneEditorLike;
  setModelMarkers(
    model: MonacoModelLike,
    owner: string,
    markers: MonacoMarkerData[],
  ): void;
}

export interface MonacoApi {
  editor: MonacoEditorApi;
  languages: {
    json: {
      jsonDefaults: {
        setDiagnosticsOptions(options: MonacoJsonDiagnosticsOptions): void;
      };
    };
    registerHoverProvider(
      languageSelector: string,
      provider: {
        provideHover(
          model: MonacoModelLike,
          position: MonacoPosition,
        ):
          | {
              contents: Array<{ value: string }>;
              range?: {
                startLineNumber: number;
                startColumn: number;
                endLineNumber: number;
                endColumn: number;
              };
            }
          | null
          | undefined;
      },
    ): MonacoDisposable;
    registerCompletionItemProvider(
      languageSelector: string,
      provider: {
        provideCompletionItems(
          model: MonacoModelLike,
          position: MonacoPosition,
          context: MonacoCompletionContext,
        ): MonacoCompletionList | null | undefined;
      },
    ): MonacoDisposable;
  };
  MarkerSeverity: {
    Error: number;
    Warning: number;
    Info: number;
    Hint: number;
  };
  KeyMod: {
    CtrlCmd: number;
  };
  KeyCode: {
    KeyS: number;
  };
}

const DEFAULT_EDITOR_LANGUAGE = "json";
const DEFAULT_VALIDATION_DELAY = 300;
const MARKER_OWNER = "zod-monaco";

export interface CreateZodEditorControllerOptions {
  monaco: MonacoApi;
  descriptor?: SchemaDescriptor;
  features?: FeatureToggles;
  value?: string;
  editorOptions?: Record<string, unknown>;
  validationDelay?: number;
}

export interface ZodEditorController extends MonacoDisposable {
  mount(element: HTMLElement): MonacoStandaloneEditorLike;
  getEditor(): MonacoStandaloneEditorLike | null;
  getValue(): string;
  setValue(value: string): void;
  setDescriptor(descriptor: SchemaDescriptor | null): void;
  onChange(
    listener: (value: string, event: MonacoEditorChangeEvent) => void,
  ): MonacoDisposable;
  onValidationChange(
    listener: (result: ValidationResult) => void,
  ): MonacoDisposable;
  revealIssue(issue: ZodIssue): void;
  format(): boolean;
}

class DefaultZodEditorController implements ZodEditorController {
  readonly #listeners = new Set<
    (value: string, event: MonacoEditorChangeEvent) => void
  >();
  readonly #validationListeners = new Set<
    (result: ValidationResult) => void
  >();

  readonly #monaco: MonacoApi;
  readonly #editorOptions: Record<string, unknown>;
  readonly #features: Required<FeatureToggles>;
  readonly #validationDelay: number;

  #editor: MonacoStandaloneEditorLike | null = null;
  #changeDisposable: MonacoDisposable | null = null;
  #hoverDisposable: MonacoDisposable | null = null;
  #completionDisposable: MonacoDisposable | null = null;
  #validationTimeout: ReturnType<typeof setTimeout> | null = null;
  #descriptor: SchemaDescriptor | null;
  #value: string;
  #schemaUri: string;

  constructor(options: CreateZodEditorControllerOptions) {
    this.#monaco = options.monaco;
    this.#editorOptions = options.editorOptions ?? {};
    this.#value = options.value ?? "";
    this.#descriptor = options.descriptor ?? null;
    this.#validationDelay = options.validationDelay ?? DEFAULT_VALIDATION_DELAY;
    this.#schemaUri = `internal://zod-monaco/${crypto.randomUUID()}.json`;

    this.#features = {
      hover: options.features?.hover ?? true,
      validation: options.features?.validation ?? true,
      completions: options.features?.completions ?? true,
      diagnostics: options.features?.diagnostics ?? true,
    };
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

    this.#applyJsonSchema();

    this.#registerHoverProvider();

    this.#registerCompletionProvider();

    this.#changeDisposable = this.#editor.onDidChangeModelContent((event) => {
      this.#value = this.#editor?.getValue() ?? "";

      for (const listener of this.#listeners) {
        listener(this.#value, event);
      }

      this.#scheduleValidation();
    });

    this.#scheduleValidation();

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
    this.#applyJsonSchema();
    this.#registerHoverProvider();
    this.#registerCompletionProvider();
    this.#scheduleValidation();
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

  dispose(): void {
    if (this.#validationTimeout) {
      clearTimeout(this.#validationTimeout);
      this.#validationTimeout = null;
    }

    const model = this.#editor?.getModel();
    if (model) {
      this.#monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
    }

    this.#clearJsonSchema();

    this.#hoverDisposable?.dispose();
    this.#hoverDisposable = null;

    this.#completionDisposable?.dispose();
    this.#completionDisposable = null;

    this.#changeDisposable?.dispose();
    this.#editor?.dispose();
    this.#editor = null;
    this.#changeDisposable = null;
    this.#listeners.clear();
    this.#validationListeners.clear();
  }

  #registerHoverProvider(): void {
    this.#hoverDisposable?.dispose();
    this.#hoverDisposable = null;

    if (!this.#features.hover || !this.#descriptor || !this.#editor) {
      return;
    }

    const model = this.#editor.getModel();
    if (!model) return;

    this.#hoverDisposable = this.#monaco.languages.registerHoverProvider(
      DEFAULT_EDITOR_LANGUAGE,
      createZodHoverProvider(this.#descriptor, model.uri.toString()),
    );
  }

  #registerCompletionProvider(): void {
    this.#completionDisposable?.dispose();
    this.#completionDisposable = null;

    if (!this.#features.completions || !this.#descriptor || !this.#editor) {
      return;
    }

    const model = this.#editor.getModel();
    if (!model) return;

    this.#completionDisposable =
      this.#monaco.languages.registerCompletionItemProvider(
        DEFAULT_EDITOR_LANGUAGE,
        createZodCompletionProvider(this.#descriptor, model.uri.toString()),
      );
  }

  #applyJsonSchema(): void {
    if (!this.#descriptor || !this.#features.validation) {
      this.#clearJsonSchema();
      return;
    }

    const model = this.#editor?.getModel();
    const fileMatch = model ? [model.uri.toString()] : ["*"];

    this.#monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: false,
      schemas: [
        {
          uri: this.#schemaUri,
          fileMatch,
          schema: this.#descriptor.jsonSchema,
        },
      ],
    });
  }

  #clearJsonSchema(): void {
    this.#monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: false,
      schemas: [],
    });
  }

  #scheduleValidation(): void {
    if (!this.#features.diagnostics || !this.#descriptor) {
      const model = this.#editor?.getModel();
      if (model) {
        this.#monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      }
      return;
    }

    if (this.#validationTimeout) {
      clearTimeout(this.#validationTimeout);
    }

    this.#validationTimeout = setTimeout(() => {
      this.#runValidation();
    }, this.#validationDelay);
  }

  #runValidation(): void {
    const editor = this.#editor;
    const descriptor = this.#descriptor;
    if (!editor || !descriptor) return;

    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this.#monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      return;
    }

    const result = descriptor.validate(parsed);

    if (result.success) {
      this.#monaco.editor.setModelMarkers(model, MARKER_OWNER, []);
      const vResult: ValidationResult = { valid: true, issues: [] };
      for (const l of this.#validationListeners) l(vResult);
      return;
    }

    const markers = result.error.issues
      .map((issue) => this.#issueToMarker(text, issue))
      .filter((m): m is MonacoMarkerData => m !== null);

    this.#monaco.editor.setModelMarkers(model, MARKER_OWNER, markers);
    const vResult: ValidationResult = { valid: false, issues: result.error.issues };
    for (const l of this.#validationListeners) l(vResult);
  }

  #issueToMarker(text: string, issue: ZodIssue): MonacoMarkerData | null {
    const position = resolveJsonPath(text, issue.path);

    if (!position) {
      return {
        severity: this.#monaco.MarkerSeverity.Error,
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
      severity: this.#monaco.MarkerSeverity.Error,
      message: issue.message,
      ...position,
      source: MARKER_OWNER,
    };
  }
}

export function createZodEditorController(
  options: CreateZodEditorControllerOptions,
): ZodEditorController {
  return new DefaultZodEditorController(options);
}
