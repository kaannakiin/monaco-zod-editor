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
  onDidChangeCursorPosition(
    listener: (event: { position: MonacoPosition }) => void,
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
