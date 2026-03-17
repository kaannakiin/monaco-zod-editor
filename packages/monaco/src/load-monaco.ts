import type { MonacoApi } from "./index.js";

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
}

const MONACO_VERSION = "0.52.2";
const DEFAULT_CDN = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

let monacoPromise: Promise<MonacoApi> | null = null;

export function loadMonaco(options?: LoadMonacoOptions): Promise<MonacoApi> {
  if (monacoPromise) return monacoPromise;

  monacoPromise = doLoad(options?.basePath ?? DEFAULT_CDN);
  return monacoPromise;
}

function doLoad(basePath: string): Promise<MonacoApi> {
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
        (monaco: MonacoApi) => resolve(monaco),
        (err: Error) => reject(err),
      );
    };
    document.head.appendChild(script);
  });
}
