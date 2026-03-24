import type { MonacoEditorApi, MonacoApi, MonacoStandaloneEditorLike } from "./monaco-types.js";

/**
 * A pass-through editor API that includes all narrow `MonacoEditorApi` members
 * plus any native Monaco editor namespace method (`defineTheme`, `setTheme`,
 * `createModel`, `colorize`, etc.).
 */
export type RawMonacoEditorApi = MonacoEditorApi & Record<string, any>;

/**
 * The full Monaco namespace as loaded from the CDN.
 *
 * Overrides the `editor` property to use `RawMonacoEditorApi` so that nested
 * access like `monaco.editor.defineTheme()` works without casting.
 *
 * For full IntelliSense, install `monaco-editor` as a devDependency and cast:
 * ```ts
 * const m = monaco as unknown as typeof import('monaco-editor');
 * ```
 */
export type RawMonaco = Omit<MonacoApi, "editor"> & {
  editor: RawMonacoEditorApi;
} & Record<string, any>;

/**
 * A full Monaco standalone editor instance.
 *
 * Extends the narrow `MonacoStandaloneEditorLike` with pass-through access
 * to every native method (`updateOptions`, `getAction`, `trigger`, etc.).
 *
 * For full IntelliSense, install `monaco-editor` as a devDependency and cast:
 * ```ts
 * const e = editor as unknown as monaco.editor.IStandaloneCodeEditor;
 * ```
 */
export type RawMonacoEditor = MonacoStandaloneEditorLike & Record<string, any>;
