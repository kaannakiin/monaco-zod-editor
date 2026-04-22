import type { MonacoApi } from "./monaco-types.js";
import type { RawMonaco } from "./raw-types.js";

export interface LoadMonacoOptions {
  onLoad?: (monaco: RawMonaco) => void | Promise<void>;
}

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

  (globalThis as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment =
    {
      ...env.MonacoEnvironment,
      getWorker(_workerId: string, label: string) {
        if (label === "json") {
          return new Worker(
            new URL(
              "monaco-editor/esm/vs/language/json/json.worker",
              import.meta.url,
            ),
            { type: "module" },
          );
        }
        return new Worker(
          new URL("monaco-editor/esm/vs/editor/editor.worker", import.meta.url),
          { type: "module" },
        );
      },
    };
}

async function doLoad(options?: LoadMonacoOptions): Promise<MonacoApi> {
  setupWorkers();

  // @ts-ignore
  const monaco = await import("monaco-editor/esm/vs/editor/editor.main");

  await options?.onLoad?.(monaco as unknown as RawMonaco);

  return monaco as unknown as MonacoApi;
}
