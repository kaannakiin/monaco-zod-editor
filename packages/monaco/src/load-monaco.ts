import loaderPkg from "@monaco-editor/loader";
import type { MonacoApi } from "./monaco-types.js";
import type { RawMonaco } from "./raw-types.js";

// @monaco-editor/loader types don't resolve under moduleResolution: "NodeNext"
const loader = loaderPkg as unknown as {
  config(params: { paths?: { vs?: string } }): void;
  init(): Promise<unknown>;
};

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

let monacoPromise: Promise<MonacoApi> | null = null;

export function loadMonaco(options?: LoadMonacoOptions): Promise<MonacoApi> {
  if (monacoPromise) return monacoPromise;
  monacoPromise = doLoad(options);
  return monacoPromise;
}

function setupWorkers(): void {
  const env = globalThis as unknown as {
    MonacoEnvironment?: { getWorker?: unknown };
  };
  if (env.MonacoEnvironment?.getWorker) return;

  (
    globalThis as unknown as { MonacoEnvironment: unknown }
  ).MonacoEnvironment = {
    ...env.MonacoEnvironment,
    getWorker(_workerId: string, label: string) {
      const workerFile =
        label === "json"
          ? "language/json/json.worker.js"
          : label === "css"
            ? "language/css/css.worker.js"
            : label === "html"
              ? "language/html/html.worker.js"
              : label === "typescript" || label === "javascript"
                ? "language/typescript/ts.worker.js"
                : "editor/editor.worker.js";
      const workerUrl = `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/esm/vs/${workerFile}`;
      const workerCode = `import ${JSON.stringify(workerUrl)};`;
      const blob = new Blob([workerCode], {
        type: "application/javascript",
      });
      return new Worker(URL.createObjectURL(blob), { type: "module" });
    },
  };
}

async function doLoad(options?: LoadMonacoOptions): Promise<MonacoApi> {
  const basePath =
    options?.basePath ??
    `https://cdn.jsdelivr.net/npm/monaco-editor@${MONACO_VERSION}/min`;

  setupWorkers();

  loader.config({ paths: { vs: `${basePath}/vs` } });

  const monaco = (await loader.init()) as MonacoApi;

  await options?.onLoad?.(monaco as RawMonaco);

  return monaco;
}
