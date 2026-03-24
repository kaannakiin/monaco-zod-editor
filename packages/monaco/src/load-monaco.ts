import type { MonacoApi } from "./index.js";
import type { RawMonaco } from "./raw-types.js";

interface AmdRequire {
  config(params: { paths: Record<string, string> }): void;
  (
    dependencies: string[],
    callback: (monaco: MonacoApi) => void,
    errorback: (err: Error) => void,
  ): void;
}

export interface LoadMonacoOptions {
  basePath?: string;
  /**
   * Called once after Monaco loads, before the returned promise resolves.
   * Use this to call `monaco.editor.defineTheme()`, register global
   * providers, or perform any other one-time Monaco setup.
   *
   * Because `loadMonaco()` caches its result as a singleton, only the
   * `onLoad` callback from the **first** caller will execute.
   */
  onLoad?: (monaco: RawMonaco) => void | Promise<void>;
}

const MONACO_VERSION = "0.52.2";
const DEFAULT_CDN = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

let monacoPromise: Promise<MonacoApi> | null = null;

export function loadMonaco(options?: LoadMonacoOptions): Promise<MonacoApi> {
  if (monacoPromise) return monacoPromise;

  monacoPromise = doLoad(options);
  return monacoPromise;
}

function doLoad(options?: LoadMonacoOptions): Promise<MonacoApi> {
  const basePath = options?.basePath ?? DEFAULT_CDN;

  return new Promise<MonacoApi>((resolve, reject) => {
    (
      globalThis as unknown as { MonacoEnvironment: unknown }
    ).MonacoEnvironment = {
      getWorkerUrl(_workerId: string, label: string) {
        if (label === "json") {
          return `${basePath}/vs/language/json/json.worker.js`;
        }
        return `${basePath}/vs/editor/editor.worker.js`;
      },
    };

    const script = document.createElement("script");
    script.src = `${basePath}/vs/loader.js`;
    script.async = true;
    script.onerror = () =>
      reject(new Error(`Failed to load Monaco loader from ${basePath}`));
    script.onload = () => {
      const amdRequire = (globalThis as unknown as { require: AmdRequire })
        .require;
      amdRequire.config({ paths: { vs: `${basePath}/vs` } });
      amdRequire(
        ["vs/editor/editor.main"],
        async (monaco: MonacoApi) => {
          try {
            await options?.onLoad?.(monaco as RawMonaco);
          } catch (err) {
            reject(err);
            return;
          }
          resolve(monaco);
        },
        (err: Error) => reject(err),
      );
    };
    document.head.appendChild(script);
  });
}
