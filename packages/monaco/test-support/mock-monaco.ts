import { LineIndex } from "../src/json-path-position.js";
import type {
  MonacoApi,
  MonacoCompletionContext,
  MonacoCompletionList,
  MonacoDisposable,
  MonacoEditorChangeEvent,
  MonacoMarkerData,
  MonacoModelLike,
  MonacoPosition,
  MonacoRange,
  MonacoStandaloneEditorLike,
} from "../src/monaco-types.js";

type HoverProvider = {
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
};

type CompletionProvider = {
  provideCompletionItems(
    model: MonacoModelLike,
    position: MonacoPosition,
    context: MonacoCompletionContext,
  ): MonacoCompletionList | null | undefined;
};

function createDisposable(onDispose?: () => void): MonacoDisposable {
  let disposed = false;

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      onDispose?.();
    },
  };
}

export interface MockModel extends MonacoModelLike {
  setValue(value: string): void;
  bumpVersion(): void;
}

export interface MockEditor extends MonacoStandaloneEditorLike {
  readonly model: MockModel;
  setValue(value: string): void;
  emitCursor(position: MonacoPosition): void;
  emitBlur(): void;
}

export interface MockMonaco extends MonacoApi {
  readonly hoverRegistrations: Array<{
    languageSelector: string;
    provider: HoverProvider;
    disposed: boolean;
  }>;
  readonly completionRegistrations: Array<{
    languageSelector: string;
    provider: CompletionProvider;
    disposed: boolean;
  }>;
  readonly diagnosticsHistory: Array<Record<string, unknown>>;
  readonly markerCalls: Array<{
    owner: string;
    resource: string;
    markers: MonacoMarkerData[];
  }>;
  readonly themeCalls: string[];
  readonly languageCalls: Array<{ resource: string; languageId: string }>;
  activeHoverProvider(): HoverProvider | null;
  activeCompletionProvider(): CompletionProvider | null;
}

export function createMockModel(
  initialText: string,
  uriString = "file:///test.json",
): MockModel {
  let text = initialText;
  let versionId = 1;

  function positionAt(offset: number) {
    const index = new LineIndex(text);
    const { line, col } = index.offsetToPosition(Math.min(offset, text.length));
    return { lineNumber: line, column: col };
  }

  return {
    uri: {
      scheme: "file",
      path: "/test.json",
      toString: () => uriString,
    },
    getValue: () => text,
    getPositionAt: (offset) => positionAt(offset),
    getVersionId: () => versionId,
    getFullModelRange: () => {
      const index = new LineIndex(text);
      return index.makePosition(0, text.length);
    },
    dispose() {},
    setValue(value: string) {
      text = value;
      versionId++;
    },
    bumpVersion() {
      versionId++;
    },
  };
}

export function createMockEditor(
  initialText: string,
  uriString?: string,
): MockEditor {
  const model = createMockModel(initialText, uriString);
  const changeListeners = new Set<(event: MonacoEditorChangeEvent) => void>();
  const cursorListeners = new Set<
    (event: { position: MonacoPosition }) => void
  >();
  const blurListeners = new Set<() => void>();

  return {
    model,
    getModel: () => model,
    getValue: () => model.getValue(),
    setValue(value: string) {
      model.setValue(value);
      for (const listener of changeListeners) {
        listener({ changes: [] });
      }
    },
    onDidChangeModelContent(listener) {
      changeListeners.add(listener);
      return createDisposable(() => {
        changeListeners.delete(listener);
      });
    },
    onDidChangeCursorPosition(listener) {
      cursorListeners.add(listener);
      return createDisposable(() => {
        cursorListeners.delete(listener);
      });
    },
    onDidBlurEditorWidget(listener) {
      blurListeners.add(listener);
      return createDisposable(() => {
        blurListeners.delete(listener);
      });
    },
    addCommand() {
      return "mock-command";
    },
    revealLineInCenter() {},
    revealRangeInCenter() {},
    setPosition() {},
    setSelections() {},
    updateOptions() {},
    focus() {},
    dispose() {},
    executeEdits(_source, edits) {
      const replacement = edits.at(-1)?.text;
      if (replacement !== undefined) {
        model.setValue(replacement);
        for (const listener of changeListeners) {
          listener({ changes: [] });
        }
      }
      return true;
    },
    emitCursor(position: MonacoPosition) {
      for (const listener of cursorListeners) {
        listener({ position });
      }
    },
    emitBlur() {
      for (const listener of blurListeners) {
        listener();
      }
    },
  };
}

export function createMockMonaco(): MockMonaco {
  const hoverRegistrations: MockMonaco["hoverRegistrations"] = [];
  const completionRegistrations: MockMonaco["completionRegistrations"] = [];
  const diagnosticsHistory: Array<Record<string, unknown>> = [];
  const markerCalls: MockMonaco["markerCalls"] = [];
  const markerStore = new Map<string, MonacoMarkerData[]>();
  const themeCalls: string[] = [];
  const languageCalls: Array<{ resource: string; languageId: string }> = [];

  return {
    hoverRegistrations,
    completionRegistrations,
    diagnosticsHistory,
    markerCalls,
    themeCalls,
    languageCalls,
    editor: {
      create(_element, options) {
        return createMockEditor(String(options.value ?? ""));
      },
      setModelMarkers(model, owner, markers) {
        const resource = model.uri.toString();
        markerStore.set(`${owner}:${resource}`, markers);
        markerCalls.push({ owner, resource, markers });
      },
      getModelMarkers(filter) {
        if (filter.owner && filter.resource) {
          return (
            markerStore.get(`${filter.owner}:${filter.resource.toString()}`) ??
            []
          );
        }

        if (filter.owner) {
          return [...markerStore.entries()]
            .filter(([key]) => key.startsWith(`${filter.owner}:`))
            .flatMap(([, markers]) => markers);
        }

        return [...markerStore.values()].flat();
      },
      setTheme(themeName) {
        themeCalls.push(themeName);
      },
      defineTheme() {},
      setModelLanguage(model, languageId) {
        languageCalls.push({ resource: model.uri.toString(), languageId });
      },
    },
    languages: {
      json: {
        jsonDefaults: {
          setDiagnosticsOptions(options) {
            diagnosticsHistory.push({ ...options });
          },
        },
      },
      register() {
        return createDisposable();
      },
      setMonarchTokensProvider() {
        return createDisposable();
      },
      setLanguageConfiguration() {
        return createDisposable();
      },
      registerHoverProvider(languageSelector, provider) {
        const registration = {
          languageSelector,
          provider,
          disposed: false,
        };
        hoverRegistrations.push(registration);
        return createDisposable(() => {
          registration.disposed = true;
        });
      },
      registerCompletionItemProvider(languageSelector, provider) {
        const registration = {
          languageSelector,
          provider,
          disposed: false,
        };
        completionRegistrations.push(registration);
        return createDisposable(() => {
          registration.disposed = true;
        });
      },
    },
    MarkerSeverity: {
      Error: 8,
      Warning: 4,
      Info: 2,
      Hint: 1,
    },
    CompletionItemKind: {
      Text: 1,
      Method: 2,
      Function: 3,
      Constructor: 4,
      Field: 5,
      Variable: 6,
      Class: 7,
      Interface: 8,
      Module: 9,
      Property: 10,
      Unit: 11,
      Value: 12,
      Enum: 13,
      EnumMember: 14,
      Keyword: 15,
      Snippet: 16,
      Color: 17,
      File: 18,
      Reference: 19,
      Folder: 20,
      Constant: 21,
      Struct: 22,
    },
    CompletionItemInsertTextRule: {
      KeepWhitespace: 1,
      InsertAsSnippet: 4,
    },
    KeyMod: {
      CtrlCmd: 2048,
    },
    KeyCode: {
      KeyS: 49,
    },
    activeHoverProvider() {
      return (
        [...hoverRegistrations].reverse().find((entry) => !entry.disposed)
          ?.provider ?? null
      );
    },
    activeCompletionProvider() {
      return (
        [...completionRegistrations].reverse().find((entry) => !entry.disposed)
          ?.provider ?? null
      );
    },
  };
}
