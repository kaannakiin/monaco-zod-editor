export interface MonacoDisposable {
  dispose(): void;
}

export interface MonacoPosition {
  lineNumber: number;
  column: number;
}

export interface MonacoModelLike {
  readonly uri: { scheme: string; path: string; toString(): string };
  getValue(): string;
  getPositionAt(offset: number): MonacoPosition;
  getVersionId(): number;
  getFullModelRange(): MonacoRange;
  dispose(): void;
}

export interface MonacoEditorChangeEvent {
  readonly changes?: readonly unknown[];
}

export interface MonacoRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface MonacoSelection {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
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
  onDidBlurEditorWidget(listener: () => void): MonacoDisposable;
  addCommand(keybinding: number, handler: () => void): string | null;
  revealLineInCenter(lineNumber: number): void;
  revealRangeInCenter(range: MonacoRange): void;
  setPosition(position: { lineNumber: number; column: number }): void;
  setSelections(selections: MonacoSelection[]): void;
  updateOptions(options: Record<string, unknown>): void;
  focus(): void;
  executeEdits(
    source: string,
    edits: Array<{
      range: MonacoRange;
      text: string;
      forceMoveMarkers?: boolean;
    }>,
  ): boolean;
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
  triggerCharacter?: string;
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
  getModelMarkers(filter: {
    owner?: string;
    resource?: { toString(): string };
  }): MonacoMarkerData[];
  setTheme(themeName: string): void;
  defineTheme(themeName: string, themeData: Record<string, unknown>): void;
  setModelLanguage(model: MonacoModelLike, languageId: string): void;
}

export interface MonacoLanguageRegistration {
  id: string;
  extensions?: string[];
  aliases?: string[];
  mimetypes?: string[];
}

export interface MonacoApi {
  editor: MonacoEditorApi;
  languages: {
    json: {
      jsonDefaults: {
        setDiagnosticsOptions(options: MonacoJsonDiagnosticsOptions): void;
      };
    };
    register(language: MonacoLanguageRegistration): void;
    setMonarchTokensProvider(
      languageId: string,
      provider: Record<string, unknown>,
    ): MonacoDisposable;
    setLanguageConfiguration(
      languageId: string,
      configuration: Record<string, unknown>,
    ): MonacoDisposable;
    registerHoverProvider(
      languageSelector: string,
      provider: {
        provideHover(
          model: MonacoModelLike,
          position: MonacoPosition,
        ):
          | {
              contents: Array<{ value: string }>;
              range?: MonacoRange;
            }
          | null
          | undefined;
      },
    ): MonacoDisposable;
    registerCompletionItemProvider(
      languageSelector: string,
      provider: {
        triggerCharacters?: string[];
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
  CompletionItemKind: {
    Text: number;
    Method: number;
    Function: number;
    Constructor: number;
    Field: number;
    Variable: number;
    Class: number;
    Interface: number;
    Module: number;
    Property: number;
    Unit: number;
    Value: number;
    Enum: number;
    EnumMember: number;
    Keyword: number;
    Snippet: number;
    Color: number;
    File: number;
    Reference: number;
    Folder: number;
    Constant: number;
    Struct: number;
  };
  CompletionItemInsertTextRule: {
    KeepWhitespace: number;
    InsertAsSnippet: number;
  };
  KeyMod: {
    CtrlCmd: number;
  };
  KeyCode: {
    KeyS: number;
  };
}
