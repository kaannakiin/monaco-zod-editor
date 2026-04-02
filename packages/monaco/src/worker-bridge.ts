import type {
  MonacoApi,
  MonacoJsonWorker,
  MonacoJsonDocument,
  MonacoJsonNode,
  MonacoMatchingSchema,
  MonacoModelLike,
} from "./monaco-types.js";

const WORKER_TIMEOUT_MS = 150;

export interface WorkerBridge {
  getNodeAtOffset(model: MonacoModelLike, offset: number): Promise<MonacoJsonNode | null>;
  getMatchingSchemas(model: MonacoModelLike): Promise<MonacoMatchingSchema[]>;
  getDocument(model: MonacoModelLike): Promise<MonacoJsonDocument | null>;
  isAvailable(): boolean;
  dispose(): void;
}

/**
 * Creates a bridge to Monaco's JSON language service worker.
 *
 * The bridge caches the worker proxy and provides timeout-guarded access.
 * When the worker is unavailable (e.g. CORS, CDN failure), all methods
 * return empty results and `isAvailable()` returns false so callers
 * can fall back to the sync custom parser.
 */
export function createWorkerBridge(monaco: MonacoApi): WorkerBridge {
  let workerProxy: ((...uris: unknown[]) => Promise<MonacoJsonWorker>) | null = null;
  let workerFailed = !monaco.languages.json.getWorker;
  let initPromise: Promise<void> | null = null;

  function init(): Promise<void> {
    if (initPromise) return initPromise;

    const getWorker = monaco.languages.json.getWorker;
    if (!getWorker) {
      workerFailed = true;
      return Promise.resolve();
    }

    initPromise = getWorker
      .call(monaco.languages.json)
      .then((proxy) => {
        workerProxy = proxy;
      })
      .catch(() => {
        workerFailed = true;
      });

    return initPromise;
  }

  async function getWorkerForModel(model: MonacoModelLike): Promise<MonacoJsonWorker | null> {
    if (workerFailed) return null;

    if (!workerProxy) {
      await init();
    }

    if (!workerProxy) return null;

    try {
      return await withTimeout(workerProxy(model.uri), WORKER_TIMEOUT_MS);
    } catch {
      return null;
    }
  }

  return {
    async getNodeAtOffset(model: MonacoModelLike, offset: number): Promise<MonacoJsonNode | null> {
      const worker = await getWorkerForModel(model);
      if (!worker) return null;

      try {
        const doc = await withTimeout(
          worker.parseJSONDocument(model.uri.toString()),
          WORKER_TIMEOUT_MS,
        );
        return doc?.getNodeFromOffset?.(offset) ?? null;
      } catch {
        return null;
      }
    },

    async getMatchingSchemas(model: MonacoModelLike): Promise<MonacoMatchingSchema[]> {
      const worker = await getWorkerForModel(model);
      if (!worker) return [];

      try {
        return await withTimeout(
          worker.getMatchingSchemas(model.uri.toString()),
          WORKER_TIMEOUT_MS,
        );
      } catch {
        return [];
      }
    },

    async getDocument(model: MonacoModelLike): Promise<MonacoJsonDocument | null> {
      const worker = await getWorkerForModel(model);
      if (!worker) return null;

      try {
        return await withTimeout(
          worker.parseJSONDocument(model.uri.toString()),
          WORKER_TIMEOUT_MS,
        );
      } catch {
        return null;
      }
    },

    isAvailable(): boolean {
      return !workerFailed;
    },

    dispose(): void {
      workerProxy = null;
      workerFailed = false;
      initPromise = null;
    },
  };
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Worker timeout")), ms),
    ),
  ]);
}
